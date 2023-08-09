'use client';

import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { Cake, FileCode, Flag, Languages } from 'lucide-react';
import { DateTime } from 'luxon';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '~/components/ui/hover-card';
import { Separator } from '~/components/ui/separator';
import { cn } from '~/lib/utils';

export const aboutStyle = cva('flex h-full flex-col space-y-6 p-10');

export type AboutProps = React.ComponentProps<'div'> &
  VariantProps<typeof aboutStyle>;

export function About({ className }: AboutProps) {
  setTimeout(updateAge, 1000);
  const now = DateTime.now();
  const birthDay = DateTime.fromObject(
    { year: 2003, month: 7, day: 11 },
    { zone: 'Atlantic/Canary' },
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
          <Card className="max-w-md px-5">
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
              <div className="flex flex-wrap items-center justify-center gap-2 align-middle">
                <HoverCard>
                  <HoverCardTrigger>
                    <Badge className="space-x-3 text-sm">
                      <Cake className="w-5" />
                      <div>{age.toFormat('yy')}</div>
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent className="flex flex-col">
                    <div>
                      {age.toFormat(
                        "yy 'years' dd 'days' hh 'hours' ss 'seconds'",
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
                <Badge className="space-x-3 text-sm">
                  <FileCode className="w-5" />
                  <div>10</div>
                </Badge>
                <Badge className="space-x-3 text-sm capitalize">
                  <Flag className="w-5" />
                  <div>Spain</div>
                </Badge>
                <Badge className="space-x-3 text-sm capitalize">
                  <Languages className="w-5" />
                  <div>Spanish</div>
                </Badge>
                <Badge className="space-x-3 text-sm capitalize">
                  <Languages className="w-5" />
                  <div>English</div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between align-middle">
                <Separator
                  className="mb-auto ml-0 mt-auto"
                  orientation="horizontal"
                />
                <span className="capitalize text-muted-foreground">
                  DESCRIPTION
                </span>
                <Separator
                  className="mb-auto mr-0 mt-auto"
                  orientation="horizontal"
                />
              </div>
              <div>
                <p className="leading-relaxed">
                  Lover of all things related to code and art. 10 years of
                  experience developing all kinds of applications with different
                  languages, frameworks and toolsets.
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
