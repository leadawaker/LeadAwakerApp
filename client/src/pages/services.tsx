import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";

export default function Services() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            Our Services
          </motion.h1>
          <p className="text-xl text-muted-foreground">
            We specialize in Database Reactivation—turning your old leads into new revenue.
          </p>
        </div>

        <div className="space-y-24">
          {/* Chat Card Section */}
          <div className="grid md:grid-cols-2 gap-12 items-center py-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1"
            >
              <h2 className="text-3xl font-bold mb-6"><span className="text-primary">Car Finance Law Firm</span> Example</h2>
              <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                Watch this real conversation unfold: Our <strong>Lead Awaker AI</strong> sends an initial SMS to cold leads checking car finance refunds. When Jack responds, the AI instantly qualifies him, handles his objection about missing documents, and guides him to complete a DSAR (Data Subject Access Request).
              </p>
              <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                <strong>What happens next:</strong> The DSAR legally compels car finance companies to send Jack's agreement documents. A <strong>law firm clerk</strong> then reviews them for mis-sold commission hidden in his payments—if found, he gets a full refund (typically £1,000-£3,000).
              </p>
              <h3 className="font-semibold text-lg mb-4">Real Results from 935 leads:</h3>
              <ul className="space-y-2 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>42% reply rate</strong> (vs industry 20%)</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>20.4% DSAR completion rate</strong></span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>Cost per DSAR: $21</strong> (fully automated—no calls, no salespeople)</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>Solicitor fees per win: $1,200-$1,800</strong></span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>My agency fee: $190 per DSAR lead</strong></span>
                </li>
              </ul>
              <p className="text-muted-foreground text-base">
                This automation delivered <strong>190 qualified cases</strong> from one SMS campaign, all handled 100% by <strong>Lead Awaker AI</strong> while you sleep. This is the exact system I build for B2B service businesses—turning cold leads into signed cases without manual follow-up.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2 max-w-md mx-auto w-full"
            >
              <ChatCard2D />
            </motion.div>
          </div>
        </div>

        <div className="mt-24 text-center">
          <Link href="/book-demo">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20">
              Start Your Campaign
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
