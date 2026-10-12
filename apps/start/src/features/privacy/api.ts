import { Language } from '@portfolio/invoices/model';
import { privacyController } from '@portfolio/invoices/privacy';
import { createServerFn } from '@tanstack/react-start';
import { Effect, Schema } from 'effect';
import { requestLanguage } from '../../server/request.server';
import { serve } from '../../server/runtime.server';
import { unavailable } from '../invoices/operations.server';

export const getPrivacyNotice = createServerFn({ method: 'GET' })
  .validator(
    Schema.decodeUnknownSync(
      Schema.Struct({ language: Schema.optional(Language) }),
    ),
  )
  .handler(({ data }) =>
    serve(
      Effect.gen(function* () {
        return {
          language: data.language ?? (yield* requestLanguage),
          controller: yield* unavailable(privacyController()),
        };
      }),
    ),
  );
