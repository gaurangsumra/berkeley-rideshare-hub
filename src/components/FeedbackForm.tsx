import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const feedbackSchema = z.object({
  feedback_type: z.enum(["bug", "feature", "question", "complaint", "compliment"], {
    required_error: "Please select a feedback type",
  }),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200, "Subject must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000, "Description must be less than 1000 characters"),
  contact_email: z.string().email("Please enter a valid email address"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  rideId?: string;
  defaultEmail?: string;
}

export const FeedbackForm = ({ rideId, defaultEmail }: FeedbackFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedback_type: undefined,
      subject: "",
      description: "",
      contact_email: defaultEmail || "",
    },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("feedback_submissions")
        .insert({
          user_id: user?.id || null,
          feedback_type: values.feedback_type,
          subject: values.subject,
          description: values.description,
          contact_email: values.contact_email,
          ride_id: rideId || null,
        });

      if (error) throw error;

      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it soon.",
      });

      form.reset({
        feedback_type: undefined,
        subject: "",
        description: "",
        contact_email: defaultEmail || "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="feedback_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feedback Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="compliment">Compliment</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="Brief summary of your feedback" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please provide details..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="your.email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Feedback
        </Button>
      </form>
    </Form>
  );
};
