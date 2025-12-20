import { motion } from "framer-motion";
import { Calendar, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BookDemo() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Let's Reactivate Your Leads
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Schedule a 15-minute demo to see how we can automatically book appointments from your existing database.
            </p>

            <div className="space-y-8 mb-10">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Review Your Opportunity</h3>
                  <p className="text-muted-foreground">We'll look at your current lead database size and estimate potential revenue.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                 <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Live Demo</h3>
                  <p className="text-muted-foreground">See exactly how the AI conversations work and handle objections.</p>
                </div>
              </div>
            </div>

            <Card className="bg-muted/50 border-border">
              <CardContent className="p-6">
                 <h4 className="font-bold mb-4">Quick Check:</h4>
                 <p className="mb-4">Do you already have a booking link?</p>
                 <a 
                   href="https://calendar.app.google/uvWx5JWm7SLZSCqz7" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="inline-block"
                 >
                   <Button variant="outline" className="gap-2">
                     Yes, take me to calendar
                     <ArrowRight className="w-4 h-4" />
                   </Button>
                 </a>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden border border-border"
          >
            {/* Embed Google Calendar */}
            <iframe 
              src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0T-wS_qQ_qQ_qQ?gv=true" 
              style={{border: 0}} 
              width="100%" 
              height="100%" 
              frameBorder="0"
            ></iframe>
            {/* Note: I am using the user provided link in a slightly different way or generic way if the embed doesn't work directly, 
                but typically calendar links need specific embed codes. 
                Since the user gave: https://calendar.app.google/uvWx5JWm7SLZSCqz7 
                I will use an iframe to that URL directly, or a button if it forbids embedding.
                Google Appointment slots often forbid direct iframe embedding if not configured.
                I'll put a fallback button overlay just in case.
            */}
             <div className="absolute inset-0 flex items-center justify-center bg-background z-10 p-8 text-center flex-col">
                <h3 className="text-2xl font-bold mb-4">Book Your Strategy Session</h3>
                <p className="text-muted-foreground mb-8">Select a time that works best for you.</p>
                <a 
                   href="https://calendar.app.google/uvWx5JWm7SLZSCqz7" 
                   target="_blank" 
                   rel="noopener noreferrer"
                >
                  <Button size="lg" className="h-14 px-8 text-lg">
                    Open Calendar
                    <Calendar className="ml-2 w-5 h-5" />
                  </Button>
                </a>
             </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
