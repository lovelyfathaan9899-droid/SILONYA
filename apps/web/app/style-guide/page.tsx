"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Container,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Grid,
  Input,
  Label,
  LoadingState,
  Reveal,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
  toast,
} from "@silonya/ui";
import { Inbox, PackageX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`border-mist h-16 w-full border ${className}`} />
      <p className="text-stone font-sans text-xs">{name}</p>
    </div>
  );
}

function StyleGuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Reveal>
      <div className="border-mist flex flex-col gap-6 border-b py-12 first:pt-0">
        <h2 className="font-display text-ink text-2xl">{title}</h2>
        {children}
      </div>
    </Reveal>
  );
}

export default function StyleGuidePage() {
  return (
    <Section spacing="lg">
      <Container>
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="font-display text-ink text-4xl">Style Guide</h1>
            <p className="text-stone mt-2 font-sans text-sm">
              Internal reference — every reusable component in the SILONYA design system
              (DESIGN_SYSTEM.md). Not a customer-facing page.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <StyleGuideSection title="Color">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            <Swatch name="ink" className="bg-ink" />
            <Swatch name="bone" className="bg-bone" />
            <Swatch name="white" className="bg-white" />
            <Swatch name="stone" className="bg-stone" />
            <Swatch name="mist" className="bg-mist" />
            <Swatch name="accent" className="bg-accent" />
            <Swatch name="error" className="bg-error" />
            <Swatch name="success" className="bg-success" />
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Typography">
          <div className="flex flex-col gap-4">
            <p className="font-display text-ink text-6xl">Editorial 6xl</p>
            <p className="font-display text-ink text-4xl">Editorial 4xl</p>
            <p className="font-display text-ink text-2xl">Editorial 2xl</p>
            <p className="text-ink font-sans text-lg">Body large — the quick brown fox.</p>
            <p className="text-ink font-sans text-base">Body base — the quick brown fox.</p>
            <p className="text-stone font-sans text-sm">
              Body small / muted — the quick brown fox.
            </p>
            <p className="text-stone font-sans text-xs uppercase tracking-wide">Micro label</p>
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Layout grid">
          <Grid>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-mist col-span-4 py-4 text-center text-xs lg:col-span-1">
                {i + 1}
              </div>
            ))}
          </Grid>
        </StyleGuideSection>

        <StyleGuideSection title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">In stock</Badge>
            <Badge variant="error">Sold out</Badge>
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Form inputs">
          <div className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-input">Email</Label>
              <Input id="sg-input" type="email" placeholder="you@example.com" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="sg-checkbox" />
              <Label htmlFor="sg-checkbox">Send me updates</Label>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sg-select">Size</Label>
              <Select>
                <SelectTrigger id="sg-select">
                  <SelectValue placeholder="Select a size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xs">XS</SelectItem>
                  <SelectItem value="s">S</SelectItem>
                  <SelectItem value="m">M</SelectItem>
                  <SelectItem value="l">L</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Card">
          <div className="max-w-sm">
            <Card>
              <CardHeader>
                <CardTitle>Wool Overcoat</CardTitle>
                <CardDescription>A considered layer for the transitional season.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-ink font-sans text-sm">PKR 42,000</p>
              </CardContent>
              <CardFooter>
                <Button size="sm">View</Button>
              </CardFooter>
            </Card>
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Breadcrumbs">
          <Breadcrumbs
            linkAs={Link}
            items={[
              { label: "Home", href: "/" },
              { label: "Women", href: "#" },
              { label: "Outerwear" },
            ]}
          />
        </StyleGuideSection>

        <StyleGuideSection title="Tabs">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
              <TabsTrigger value="care">Care</TabsTrigger>
            </TabsList>
            <TabsContent value="details">Details content.</TabsContent>
            <TabsContent value="shipping">Shipping content.</TabsContent>
            <TabsContent value="care">Care content.</TabsContent>
          </Tabs>
        </StyleGuideSection>

        <StyleGuideSection title="Accordion">
          <Accordion type="single" collapsible className="max-w-xl">
            <AccordionItem value="a">
              <AccordionTrigger>What is your return policy?</AccordionTrigger>
              <AccordionContent>Returns are accepted within 30 days of delivery.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Do you ship internationally?</AccordionTrigger>
              <AccordionContent>
                Global shipping is on the roadmap (ROADMAP.md Phase 4).
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </StyleGuideSection>

        <StyleGuideSection title="Dropdown menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Recommended</DropdownMenuItem>
              <DropdownMenuItem>Price: low to high</DropdownMenuItem>
              <DropdownMenuItem>Newest</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </StyleGuideSection>

        <StyleGuideSection title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogDescription>This is a dialog primitive, styled to tokens.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary">Cancel</Button>
                <Button>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </StyleGuideSection>

        <StyleGuideSection title="Toast">
          <Button
            variant="secondary"
            onClick={() => {
              toast({
                title: "Added to bag",
                description: "Wool Overcoat, size M.",
                variant: "success",
              });
            }}
          >
            Trigger toast
          </Button>
        </StyleGuideSection>

        <StyleGuideSection title="Skeleton & Spinner">
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-40" />
            </div>
            <Spinner />
          </div>
        </StyleGuideSection>

        <StyleGuideSection title="Empty / Error / Loading states">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="border-mist border">
              <EmptyState
                icon={Inbox}
                title="No results"
                description="Try adjusting your filters."
              />
            </div>
            <div className="border-mist border">
              <ErrorState
                icon={PackageX}
                title="Couldn't load this"
                description="Something went wrong on our end."
              />
            </div>
            <div className="border-mist border">
              <LoadingState label="Loading products" />
            </div>
          </div>
        </StyleGuideSection>
      </Container>
    </Section>
  );
}
