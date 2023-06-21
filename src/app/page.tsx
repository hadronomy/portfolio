import { Hero } from '~/components/hero';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter
} from '~/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Separator } from '~/components/ui/separator';
import { Badge } from '~/components/ui/badge';
import { Cake, Code2 } from 'lucide-react';

export const metadata = {
  title: 'Hadronomy - Pablo Hernández'
};

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-col">
      <section id="hero" className="flex h-screen flex-col">
        <Hero />
      </section>
      <section id="about" className="flex h-screen flex-col">
        <div className="flex h-full flex-col p-10">
          <div className="p-5">
            <h1 className="text-3xl font-semibold tracking-tighter">
              About Me
            </h1>
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
                      <AvatarFallback className="rounded-lg">
                        HDR
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>Pablo Hernández Jiménez</CardTitle>
                      <CardDescription>@hadronomy</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center justify-center space-x-3 align-middle">
                    <Badge className="space-x-3 text-lg">
                      <Cake />
                      <a>19</a>
                    </Badge>
                    <Badge className="space-x-3 text-lg">
                      <Code2 />
                      <a>10</a>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between align-middle">
                    <Separator
                      className="mb-auto mt-auto"
                      orientation="horizontal"
                    />
                    <a className="capitalize text-muted-foreground">
                      DESCRIPTION
                    </a>
                    <Separator
                      className="mb-auto mt-auto"
                      orientation="horizontal"
                    />
                  </div>
                  <div className="px-5">
                    <p className="text-justify leading-relaxed">
                      Lorem ipsum dolor, sit amet consectetur adipisicing elit.
                      Aperiam, qui. Ullam, velit eius! Fuga odit mollitia
                      maiores iusto suscipit quibusdam, recusandae ea quasi quos
                      officia, temporibus ut excepturi aperiam necessitatibus!
                      Magni, minima iste fuga architecto fugiat possimus iure
                      ipsam eos in quos. Magni odio consequuntur ad odit,
                      necessitatibus, natus debitis veniam error sunt nemo
                      fugiat rerum earum. Vel, quas in.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div></div>
          </div>
        </div>
      </section>
      <section id="contact" className="flex h-screen flex-col">
        {/* Contact */}
      </section>
      {/* Footer */}
    </main>
  );
}
