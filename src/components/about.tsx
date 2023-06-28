'use client';

import * as React from 'react';
import { Cake, FileCode, Flag, Languages } from 'lucide-react';
import { cva, VariantProps } from 'class-variance-authority';
import { DateTime } from 'luxon';

import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '~/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Separator } from '~/components/ui/separator';
import { Badge } from '~/components/ui/badge';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from '~/components/ui/hover-card';
import { cn } from '~/lib/utils';

export const aboutStyle = cva('flex h-full flex-col space-y-6 p-10');

export type AboutProps = React.ComponentProps<'div'> &
  VariantProps<typeof aboutStyle>;

export function About({ className }: AboutProps) {
  setTimeout(updateAge, 1000);
  const now = DateTime.now();
  const birthDay = DateTime.fromObject(
    { year: 2003, month: 7, day: 11 },
    { zone: 'Atlantic/Canary' }
  );
  const [age, setAge] = React.useState(now.diff(birthDay));

  function updateAge() {
    const newAge = now.diff(birthDay);
    setAge(newAge);
  }

  return (
    <div className={cn(aboutStyle({ className }))}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tighter">About Me</h1>
      </div>
      <div className="grid h-full grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <Card>
            <CardHeader className="mt-3 items-center justify-center space-y-3 align-middle">
              <div className="space-y-5">
                <Avatar className="h-52 w-52 rounded-lg ring-4 ring-foreground">
                  <AvatarImage
                    src="https://github.com/hadronomy.png"
                    alt="hadronomy"
                  />
                  <AvatarFallback className="rounded-lg">HDR</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>Pablo Hernández Jiménez</CardTitle>
                  <CardDescription>@hadronomy</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 align-middle">
                <HoverCard>
                  <HoverCardTrigger>
                    <Badge className="space-x-3 text-lg">
                      <Cake />
                      <div>{age.toFormat('yy')}</div>
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent className="flex flex-col">
                    <div>
                      {age.toFormat(
                        "yy 'years' dd 'days' hh 'hours' ss 'seconds'"
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
                <Badge className="space-x-3 text-lg">
                  <FileCode />
                  <div>10</div>
                </Badge>
                <Badge className="space-x-3 text-lg">
                  <Flag />
                  <div>Spain</div>
                </Badge>
                <Badge className="space-x-3 text-lg">
                  <Languages />
                  <div>Spanish</div>
                </Badge>
                <Badge className="space-x-3 text-lg">
                  <Languages />
                  <div>English</div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between align-middle">
                <Separator
                  className="mb-auto mt-auto"
                  orientation="horizontal"
                />
                <a className="capitalize text-muted-foreground">DESCRIPTION</a>
                <Separator
                  className="mb-auto mt-auto"
                  orientation="horizontal"
                />
              </div>
              <div className="px-5">
                <p className="text-justify leading-relaxed">
                  Lover of all things related to code and art. 10 years of experience
                  developing all kinds of applications with different languages,
                  frameworks and toolsets.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div></div>
      </div>
    </div>
  );
}
