import type { CountryCode } from '@portfolio/invoices/address';
import {
  type AddressSuggestion,
  localityFrom,
  PhotonResponse,
  suggestionsFrom,
} from '@portfolio/invoices/photon';
import { Cache, Context, Duration, Effect, Exit, Layer } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';
import { AppConfig } from '~/server/config.server';

// Address search goes through the server so the browser never talks to the
// geocoder: the answer is decoded before it is trusted, and repeats are
// served from memory. Photon's public instance is shared and fair-use, so
// asking it twice for the same thing is not free.

export interface GeocoderApi {
  /** Addresses in `country` that match what the owner is typing. Empty when the geocoder does not answer. */
  readonly search: (
    query: string,
    country: CountryCode,
  ) => Effect.Effect<readonly AddressSuggestion[]>;
  /** The locality a postal code belongs to, when OpenStreetMap knows it. */
  readonly locality: (
    postalCode: string,
    country: CountryCode,
  ) => Effect.Effect<string | null>;
}

/** Address lookup over Photon. */
export class Geocoder extends Context.Service<Geocoder, GeocoderApi>()(
  'Geocoder',
) {}

/** One lookup as a cache key. Effect compares plain records by value, so equal lookups are one entry. */
interface Lookup {
  readonly country: CountryCode;
  readonly text: string;
}

// A failed lookup is not remembered: the next keystroke may well succeed.
const remembered = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isSuccess(exit) ? Duration.minutes(10) : Duration.zero;

export const geocoderLayer = Layer.effect(
  Geocoder,
  Effect.gen(function* () {
    const { geocoderUrl } = yield* AppConfig;
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.setHeaders({
          Accept: 'application/json',
          'User-Agent': 'hadronomy-invoices/1.0 (+https://hadronomy.com)',
        }),
      ),
      HttpClient.filterStatusOk,
    );

    const photon = (params: Record<string, string | readonly string[]>) =>
      client.get(new URL('/api', geocoderUrl), { urlParams: params }).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(PhotonResponse)),
        // Suggestions that arrive after the owner has typed on are worthless.
        Effect.timeout('4 seconds'),
        Effect.withSpan('Geocoder.photon'),
      );

    const searches = yield* Cache.makeWith(
      ({ country, text }: Lookup) =>
        photon({
          q: text,
          limit: '8',
          // Local names: an address is written in its own country's words.
          lang: 'default',
          countrycode: country,
          layer: ['house', 'street'],
        }).pipe(
          Effect.map((response) =>
            suggestionsFrom(response, country).slice(0, 6),
          ),
        ),
      { capacity: 500, timeToLive: remembered },
    );
    const localities = yield* Cache.makeWith(
      // An unknown code is a real answer, and worth remembering as one.
      ({ country, text }: Lookup) =>
        photon({
          q: text,
          limit: '3',
          lang: 'default',
          countrycode: country,
          osm_tag: 'place:postcode',
        }).pipe(Effect.map(localityFrom)),
      { capacity: 500, timeToLive: remembered },
    );

    return Geocoder.of({
      search: (query, country) => {
        const text = query.trim().toLowerCase();
        return text.length < 3
          ? Effect.succeed([])
          : Cache.get(searches, { country, text }).pipe(
              Effect.orElseSucceed(() => []),
              Effect.withSpan('Geocoder.search'),
            );
      },
      locality: (postalCode, country) => {
        const text = postalCode.trim();
        return !text
          ? Effect.succeed(null)
          : Cache.get(localities, { country, text }).pipe(
              Effect.orElseSucceed(() => null),
              Effect.withSpan('Geocoder.locality'),
            );
      },
    });
  }),
);
