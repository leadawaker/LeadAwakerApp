import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Briefcase, Dumbbell, Utensils, Sun, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";

const CASES = [
  {
    id: 1,
    title: "Car Finance Law Firm",
    icon: <Briefcase className="w-6 h-6" />,
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">Case 1 - <span className="text-primary">Car Finance Law Firm</span></h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Watch this real conversation unfold: Our <strong>Lead Awaker AI</strong> sends an initial SMS to cold leads checking car finance refunds. When Jack responds, the AI instantly qualifies him, handles his objection about missing documents, and guides him to complete a DSAR (Data Subject Access Request).
        </p>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          <strong>What happens next:</strong> The DSAR legally compels car finance companies to send Jack's agreement documents. A <strong>law firm clerk</strong> then reviews them for mis-sold commission hidden in his payments -- if found, he gets a full refund (typically £1,000-£3,000).
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
            <span><strong>Cost per DSAR: $21</strong> (fully automated -- no calls, no salespeople)</span>
          </li>
        </ul>
      </>
    )
  },
  {
    id: 2,
    title: "Gym Membership",
    icon: <Dumbbell className="w-6 h-6" />,
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">Case 2 - <span className="text-primary">Gym Membership</span></h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Reactivating former members who cancelled during the off-season. Our AI handles the "I'm too busy" objection with a specialized 15-minute express workout offer.
        </p>
        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>15% Re-signup rate</strong> within 48 hours</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>Automated booking</strong> for induction sessions</span>
          </li>
        </ul>
      </>
    )
  },
  {
    id: 3,
    title: "B2B Catering",
    icon: <Utensils className="w-6 h-6" />,
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">Case 3 - <span className="text-primary">B2B Catering</span></h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Targeting past corporate clients for event season. AI analyzes past order history to suggest personalized menus and volume discounts.
        </p>
        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>3.5x ROI</strong> on database reactivation</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>Zero manual outreach</strong> required by sales team</span>
          </li>
        </ul>
      </>
    )
  },
  {
    id: 4,
    title: "Solar Panel",
    icon: <Sun className="w-6 h-6" />,
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">Case 4 - <span className="text-primary">Solar Panel Installation</span></h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Re-engaging homeowners who received a quote but didn't proceed. Our <strong>Eco-Response AI</strong> updates them on new government grants and reduced equipment costs, handling technical questions about battery storage and installation timelines.
        </p>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          <strong>What happens next:</strong> Once intent is confirmed, the AI schedules a technical site survey directly into the installation team's calendar, ensuring no momentum is lost.
        </p>
        <h3 className="font-semibold text-lg mb-4">Expected Performance:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>12.5% Appointment rate</strong> from 6+ month old leads</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>Automated qualification</strong> of roof type and orientation</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>Calendar sync</strong> with real-time surveyor availability</span>
          </li>
        </ul>
      </>
    )
  },
  {
    id: 5,
    title: "High End Travel Company",
    icon: <Globe className="w-6 h-6" />,
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">Case 5 - <span className="text-primary">High End Travel Company</span></h2>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Personalized luxury travel suggestions based on preferred climates and past booking value. AI acts as a concierge to pre-qualify holiday preferences.
        </p>
        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>$15,000 Avg. booking value</strong> reactivated</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span><strong>98% CSAT</strong> on automated interactions</span>
          </li>
        </ul>
      </>
    )
  }
];

export default function Services() {
  const [activeCase, setActiveCase] = useState(0);

  return (
    <div className="min-h-screen pt-24 pb-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
          >
            Real Case Studies
          </motion.h1>
          <p className="text-xl text-slate-600">
            Select a case study below to see how our AI handles different industries and use cases.
          </p>
        </div>

        {/* Case Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {CASES.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActiveCase(index)}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 min-w-[200px] flex-1 md:flex-none ${
                activeCase === index
                  ? "bg-white border-primary shadow-xl shadow-primary/10 scale-105"
                  : "bg-white/50 border-slate-200 hover:border-slate-300 grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
              }`}
            >
              <span className={`text-sm font-bold uppercase tracking-wider mb-2 ${activeCase === index ? "text-primary" : "text-slate-500"}`}>
                Case {item.id}
              </span>
              <div className={`mb-3 ${activeCase === index ? "text-primary" : "text-slate-400"}`}>
                {item.icon}
              </div>
              <span className={`font-bold text-center leading-tight ${activeCase === index ? "text-slate-900" : "text-slate-500"}`}>
                {item.title}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCase}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 md:order-1">
                {CASES[activeCase].description}
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <p className="text-slate-500 text-sm italic">
                    Note: This interaction is handled 100% by Lead Awaker AI. No human intervention required until intent is confirmed.
                  </p>
                </div>
              </div>
              
              <div className="order-1 md:order-2 max-w-md mx-auto w-full">
                <div className="relative">
                  <div className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] blur-2xl -z-10" />
                  <ChatCard2D />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-24 text-center">
          <Link href="/book-demo">
            <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
              Apply to Your Business
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
