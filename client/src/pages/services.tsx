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
              <h2 className="text-3xl font-bold mb-4">Live AI Chat Automation Example</h2>
              <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                Watch this real conversation unfold: Our Lead Awaker AI sends an initial SMS to cold leads checking car finance refunds. When Jack responds, the AI instantly qualifies him, handles his objection about missing documents, and guides him to complete a DSAR (Data Subject Access Request).
              </p>
              <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                What happens next: The DSAR legally compels car finance companies to send Jack's agreement documents. A law firm clerk then reviews them for mis-sold commission hidden in his payments—if found, he gets a full refund (typically £1,000-£3,000).
              </p>
              <h3 className="font-semibold text-lg mb-3">Real Results from 935 leads:</h3>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>42% reply rate (vs industry 20%)</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>20.4% DSAR completion rate</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Cost per DSAR: $21 (fully automated—no calls, no salespeople)</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Solicitor fees per win: $1,200-$1,800</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>My agency fee: $190 per DSAR lead</span>
                </li>
              </ul>
              <p className="text-muted-foreground text-base">
                This single automation generated 190 qualified cases × $190 = $36,100 revenue from one SMS campaign, all handled 100% by Lead Awaker AI while you sleep. This is the exact system I build for B2B service businesses—turning cold leads into signed cases without manual follow-up.
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
