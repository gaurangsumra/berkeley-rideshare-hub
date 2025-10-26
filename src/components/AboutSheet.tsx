import { ReactNode, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, Car, Users, Star, Shield, Leaf, DollarSign, Heart } from "lucide-react";
import { FeedbackForm } from "./FeedbackForm";
import { supabase } from "@/integrations/supabase/client";

interface AboutSheetProps {
  trigger: ReactNode;
  rideId?: string;
}

export const AboutSheet = ({ trigger, rideId }: AboutSheetProps) => {
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUserEmail();
  }, []);

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">About Berkeley Rides</SheetTitle>
        </SheetHeader>

        <div className="space-y-8 pb-20 mt-6">
          {/* Hero Section */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your trusted community for sharing rides to events and destinations. Built by Berkeley students, for the Berkeley community.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          {/* What is Berkeley Rides */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">What is Berkeley Rides?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Berkeley Rides is a closed community platform designed to make event travel safe, affordable, and social. Whether you're heading to Tahoe, Wine Country, the airport, or anywhere else, you can create or join rides with verified Berkeley students and trusted invited guests.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unlike traditional ridesharing apps, Berkeley Rides is built on trust and accountability. Our unique rating system ensures everyone shows up when they say they will, creating a reliable community you can count on.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          {/* How It Works */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">How It Works</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">1. Browse or Create Events</p>
                  <p className="text-sm text-muted-foreground">Find upcoming events or create your own. Berkeley students can create events; everyone can join rides.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">2. Organize Your Ride</p>
                  <p className="text-sm text-muted-foreground">Create or join a ride group. Set meeting points, departure times, and coordinate details in group chat.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">3. Share the Journey</p>
                  <p className="text-sm text-muted-foreground">Connect with your ride mates, split costs fairly, and enjoy the trip together.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">4. Build Your Reputation</p>
                  <p className="text-sm text-muted-foreground">After each ride, verify attendance and rate your companions. Your rating reflects your reliability.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Our Mission */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Our Mission</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium">Trust & Safety</p>
                </div>
                <p className="text-xs text-muted-foreground">Verified Berkeley.edu emails and invited guests only</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium">Community</p>
                </div>
                <p className="text-xs text-muted-foreground">Build connections beyond campus</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium">Cost Savings</p>
                </div>
                <p className="text-xs text-muted-foreground">Split rides and make travel affordable</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  <p className="text-sm font-medium">Sustainability</p>
                </div>
                <p className="text-xs text-muted-foreground">Fewer cars, lower emissions</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Rating System Deep Dive */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">How Our Rating System Works</h3>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              At Berkeley Rides, trust and accountability are everything. Our rating system is designed to reflect <strong>actual reliability</strong>, not just popularity.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">The Formula</p>
              <p className="text-sm font-mono bg-background/80 rounded px-3 py-2">
                Displayed Rating = Average Star Rating × (Completion Rate ÷ 100)
              </p>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Example:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>10 total rides joined</li>
                  <li>8 rides confirmed as completed (80% rate)</li>
                  <li>Average 4.5 stars from companions</li>
                  <li><strong>Your rating: 4.5 × 0.80 = 3.6 stars</strong></li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">How Completion Works</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>24 hours after event ends, all ride members get a survey</li>
                <li>Survey asks: "Who showed up?" (including yourself)</li>
                <li>If <strong>majority</strong> (&gt;50%) confirm you attended → completed</li>
                <li>In 50/50 ties, your self-report is the tiebreaker</li>
                <li>Only after completion can you rate companions</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Why This Matters</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Prevents "gaming" the system</li>
                <li>Rewards consistency and reliability</li>
                <li>New users start with "N/A" (fair for everyone)</li>
                <li>You can only rate people you actually rode with</li>
              </ul>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* FAQ Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
            
            <Accordion type="single" collapsible className="w-full">
              {/* Getting Started */}
              <AccordionItem value="getting-started">
                <AccordionTrigger className="text-sm font-medium">Getting Started</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">Who can use Berkeley Rides?</p>
                    <p>Anyone with a verified Berkeley.edu email can create an account and access all features. Non-Berkeley users can join if they're invited to a specific ride by a member.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">How do I join if I'm not a Berkeley student?</p>
                    <p>You'll need an invitation link from an existing ride member. These links are ride-specific and grant access to that event only.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Do I need to verify my email?</p>
                    <p>Yes, for Berkeley students. Email verification ensures our community stays trusted and safe.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Creating & Joining Rides */}
              <AccordionItem value="rides">
                <AccordionTrigger className="text-sm font-medium">Creating & Joining Rides</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">How do I create a ride?</p>
                    <p>Find an event on the Events page, click "Create Ride Group," set capacity, departure time, and travel mode. Your ride will appear immediately for others to join.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Can I join multiple rides for the same event?</p>
                    <p>No, you can only join one ride group per event to prevent double-booking and confusion.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">What happens if a ride fills up?</p>
                    <p>You can create a new ride group or wait for someone to leave. Ride creators can adjust capacity if needed.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Can I leave a ride after joining?</p>
                    <p>Yes, but please leave as early as possible so others can plan accordingly. Your departure will notify all members.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Ratings & Trust */}
              <AccordionItem value="ratings">
                <AccordionTrigger className="text-sm font-medium">Ratings & Trust</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">How is my rating calculated?</p>
                    <p>Your rating = (Average star rating) × (Completion rate ÷ 100). This ensures your score reflects both quality and reliability.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">What counts as a completed ride?</p>
                    <p>A ride is completed when the majority of members confirm you attended via the 24-hour post-event survey.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Why is my rating "N/A"?</p>
                    <p>New users show "N/A" until they complete their first ride. This gives everyone a fair start without judgment.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">What if someone marks me incorrectly?</p>
                    <p>We use consensus voting. If the majority confirms you attended, one incorrect vote won't affect your completion status.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Payments */}
              <AccordionItem value="payments">
                <AccordionTrigger className="text-sm font-medium">Payments</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">How do I pay for my share?</p>
                    <p>Rides with Uber/Lyft can generate Venmo payment links. For other rides, coordinate payment directly with your group via chat.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">When should I pay?</p>
                    <p>Payment should be completed within 24 hours after the ride. Prompt payment builds trust and maintains your reputation.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">What if someone doesn't pay?</p>
                    <p>This can affect their rating if noted in reviews. For serious issues, use the feedback form to report concerns.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Safety */}
              <AccordionItem value="safety">
                <AccordionTrigger className="text-sm font-medium">Safety & Issues</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">What if I feel unsafe during a ride?</p>
                    <p>Your safety is our priority. Exit the situation immediately, then report the incident via our feedback form with as much detail as possible.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">How do I report a problem?</p>
                    <p>Use the feedback form below or email support@TBD. For urgent safety concerns, contact campus police or local authorities first.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Are drivers vetted?</p>
                    <p>All users must have verified Berkeley emails or be invited by trusted members. Check ratings and completion rates before joining rides.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Technical */}
              <AccordionItem value="technical">
                <AccordionTrigger className="text-sm font-medium">Technical Questions</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">What browsers are supported?</p>
                    <p>Berkeley Rides works best on Chrome, Firefox, Safari, and Edge. Make sure your browser is up to date for the best experience.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">How do notifications work?</p>
                    <p>You'll receive notifications for new messages, ride updates, and attendance surveys. Check the bell icon in the top right to manage them.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Is there a mobile app?</p>
                    <p>Not yet! Berkeley Rides is currently web-based and mobile-responsive. You can add it to your phone's home screen for app-like access.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="h-px bg-border/50" />

          {/* Feedback Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Feedback & Support</h3>
            <p className="text-sm text-muted-foreground">
              Have a question, suggestion, or issue? We'd love to hear from you.
            </p>
            <FeedbackForm rideId={rideId} defaultEmail={userEmail} />
          </div>

          <div className="h-px bg-border/50" />

          {/* Contact Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Contact</h3>
            <p className="text-sm text-muted-foreground">
              Email: <span className="font-medium">support@TBD</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Response time: Within 24-48 hours
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
