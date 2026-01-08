import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Dumbbell,
  Utensils,
  Sun,
  Globe,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";

/*
Notes:
- Messages show FIRST NAME only.
- Full header name is provided via `leadFullName` (implement in ChatCard2D).
- System tags are plain text.
- SPIN flow: low-friction opener -> permission/excuse -> directed discovery. [web:97][web:141]
*/

type CaseItem = {
  id: number;
  title: string;
  color: string;
  darkColor: string;
  icon: JSX.Element;
  leadFullName: string;
  description: JSX.Element;
  messages: Array<{
    type: "agent" | "user" | "system";
    sender?: string;
    content: string;
    time?: string;
    id?: string;
  }>;
};

const CASES: CaseItem[] = [
  {
    id: 6,
    title: "Law Firm",
    color: "#2563EB",
    darkColor: "#1E40AF",
    icon: <Briefcase className="w-6 h-6" />,
    leadFullName: "Oliver Harris",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 6 - <span style={{ color: "#1E40AF" }}>Law Firm</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Our <strong>Lead Awaker AI</strong> reactivates cold leads for car finance refunds and quickly moves them into the
          only step that matters: getting the agreement documents. It qualifies eligibility, handles the “I don’t have the paperwork”
          blocker, then guides the lead through a DSAR (Data Subject Access Request) so your team only touches cases that are ready.
        </p>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          <strong>What happens next:</strong> The DSAR compels car finance companies to send the agreement documents.
          A <strong>law firm clerk</strong> reviews them for mis-sold commission hidden in payments, and if found,
          the client can claim a refund (often £1,000-£3,000).
        </p>

        <h3 className="font-semibold text-lg mb-4">Real Results from 935 leads:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#1E40AF" }} />
            <span><strong>42% reply rate</strong> (vs industry 20%)</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#1E40AF" }} />
            <span><strong>20.4% DSAR completion rate</strong></span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#1E40AF" }} />
            <span><strong>Cost per DSAR: $21</strong> (fully automated, no calls, no salespeople)</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> DSAR completion reminders, “30 working day” status updates,
            auto-escalation to a clerk when documents arrive, and reactivation campaigns for leads that started but did not finish.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Compliance-first admin. Clear, process-led, and low-pressure.
          </p>
        </div>
      </>
    ),
    messages: [
      {
        type: "agent",
        sender: "Sophie",
        content:
          "Hi, this is Sophie from Sterling Finance. Is this Oliver who wanted to check whether they were owed a refund on their car finance?",
        time: "14:35",
      },
      { type: "system", content: "Lead engaged", id: "lf-1" },
      { type: "agent", sender: "Sophie", content: "Just bumping this up in case you got busy before :)", time: "14:55" },
      { type: "user", sender: "Oliver", content: "Hi, yes", time: "15:00" },
      { type: "system", content: "Lead replied", id: "lf-2" },
      { type: "user", sender: "Oliver", content: "I would like to check. I had 2 cars on finance 5 years ago", time: "15:01" },
      { type: "system", content: "Lead qualified", id: "lf-3" },
      { type: "agent", sender: "Sophie", content: "That’s great, Oliver. Do you happen to have your vehicle finance agreement documents handy for those cars?", time: "15:04" },
      { type: "user", sender: "Oliver", content: "No sorry", time: "15:05" },
      { type: "user", sender: "Oliver", content: "Not at hand", time: "15:05" },
      { type: "agent", sender: "Sophie", content: "No worries at all. We can submit a Data Subject Access Request (DSAR) on your behalf to retrieve those documents.\n\nCould you please complete this short DSAR form by clicking this URL? https://www.dsarform.com/lead315", time: "15:09" },
      { type: "user", sender: "Oliver", content: "What is the process from here?", time: "15:20" },
      { type: "user", sender: "Oliver", content: "Do you let me know if I'm eligible once you retrieve the docs and then I confirm I want to proceed?", time: "15:20" },
      { type: "agent", sender: "Sophie", content: "Absolutely.\n\nOnce you complete the DSAR form, we request your agreement and review it. If we find you are eligible for a claim, we will get in touch to discuss next steps.\n\nIt typically takes around 30 working days to receive and review the documents. We operate on a no-win, no-fee basis, so there is no risk to you.\n\nForm link: https://www.dsarform.com/lead315", time: "15:22" },
      { type: "user", sender: "Oliver", content: "Thanks.", time: "15:24" },
      { type: "system", content: "Appointment booked 📅", id: "lf-4" },
      { type: "agent", sender: "Sophie", content: "Thanks for completing the form. You will hear from us soon. If you have any questions, feel free to ask 🙂", time: "15:39" },
      { type: "user", sender: "Oliver", content: "No, that is all from me", time: "15:40" },
      { type: "system", content: "Closed", id: "lf-5" },
      { type: "agent", sender: "Sophie", content: "Ok Oliver, have a great day :)", time: "15:41" },
    ],
  },

  {
    id: 2,
    title: "Gym Membership",
    color: "#8B5CF6",
    darkColor: "#7C3AED",
    icon: <Dumbbell className="w-6 h-6" />,
    leadFullName: "Mark Evans",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 2 - <span style={{ color: "#7C3AED" }}>Gym Membership</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          This reactivation flow is built like a real sales conversation, not a generic “come back” text.
          The AI starts with a low-friction identity check, uses a natural excuse to re-open the conversation,
          then runs SPIN-style discovery to diagnose churn and build a plan. It handles a second lifestyle objection
          (new baby), then converts intent into a personal trainer plan appointment. [web:97][web:95]
        </p>

        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#7C3AED" }} />
            <span><strong>15% Re-signup rate</strong> within 48 hours</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#7C3AED" }} />
            <span><strong>Automated booking</strong> for PT plan sessions</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> Automated “missed workout” follow-ups,
            cancellation save sequences, reactivation offers triggered by time away, PT lead nurturing,
            and membership renewal reminders.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Motivational coach. High empathy, high energy, and keeps momentum toward a next step.
          </p>
        </div>
      </>
    ),
    messages: [
      {
        type: "agent",
        sender: "Sara",
        content:
          "Hi Mark, it’s Sara from IronPulse Fitness Club here. Is this the same Mark who used to be a member with us a while back? 🙂",
        time: "10:00 AM",
      },
      { type: "system", content: "Lead engaged", id: "gym-1" },

      { type: "user", sender: "Mark", content: "yes thats me", time: "10:12 AM" },
      { type: "system", content: "Lead replied", id: "gym-2" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "Nice. My calendar pinged me to follow up, but I didn’t want to spam you.\n\nAre you still looking to get back into training?",
        time: "10:13 AM",
      },

      // missing lead answer (added)
      { type: "user", sender: "Mark", content: "yes but im not sure", time: "10:18 AM" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "Totally fair.\n\nWhen you were training with us, what was the main goal you cared about most? Strength, fat loss, or just consistency?",
        time: "10:19 AM",
      },

      { type: "user", sender: "Mark", content: "strength and consistency", time: "10:26 AM" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "Got it.\n\nWhat made you stop coming in last time? Was it time, motivation, or you weren’t seeing progress fast enough?",
        time: "10:27 AM",
      },

      { type: "user", sender: "Mark", content: "progress", time: "10:34 AM" },
      { type: "user", sender: "Mark", content: "I couldnt tell if I was improving", time: "10:34 AM" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "That’s the worst, because then it feels like effort with no reward.\n\nIf you had clear proof each month that you’re improving, would it be easier to stick with it?",
        time: "10:35 AM",
      },

      { type: "user", sender: "Mark", content: "yes, it is sort of a pattern with me, I start motivated but then it fizzles out", time: "10:42 AM" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "I hear you Mark.\n\nWe do a monthly check-in so you can see progress clearly, and we adjust the plan fast.\n\nBefore I suggest the best next step, what is the biggest constraint right now: time, energy, or motivation?",
        time: "10:43 AM",
      },

      // updated: lead says time is tight + baby in two messages
      { type: "user", sender: "Mark", content: "time is tight", time: "10:50 AM" },
      { type: "user", sender: "Mark", content: "we just had a baby so its unpredictable", time: "10:51 AM" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "Congrats on your baby! 🎉\n\nThat's exactly when a simple plan helps most.\n\nLet's book a quick personal trainer plan appointment so you and the PT can map out a realistic routine. Sound good?",
        time: "10:52 AM",
      },

      { type: "system", content: "Lead qualified", id: "gym-3" },

      { type: "user", sender: "Mark", content: "yes ok", time: "10:58 AM" },

      { type: "agent", sender: "Sara", content: "Great.\n\nHere’s the booking link: https://calendar.app.google/uvWx5JWm7SLZSCqz7", time: "10:59 AM" },

      { type: "system", content: "Appointment booked 📅", id: "gym-4" },

      {
        type: "agent",
        sender: "Sara",
        content:
          "Awesome, you’re booked for Monday 4pm ✅\n\nYour personal trainer will call you then to build a plan that fits your schedule.\n\nIf anything changes, reply here and we’ll reschedule.",
        time: "11:05 AM",
      },

      { type: "user", sender: "Mark", content: "perfect thanks", time: "11:10 AM" },

      // end with AI final message (added)
      { type: "agent", sender: "Sara", content: "You are welcome, have a good day 🙂", time: "11:11 AM" },
      { type: "system", content: "Closed", id: "gym-5" },
    ],
  },

  {
    id: 3,
    title: "Restaurant Booking",
    color: "#F97316",
    darkColor: "#C2410C",
    icon: <Utensils className="w-6 h-6" />,
    leadFullName: "Steve Parker",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 3 - <span style={{ color: "#C2410C" }}>Restaurant Booking</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          This flow shows “reactivation + conversion” in a fast-moving niche. The AI restarts an abandoned inquiry, captures the key booking
          details, confirms special requests, and then handles rescheduling instantly when plans change. It keeps the guest experience friendly
          while protecting staff time and reducing missed reservations.
        </p>

        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#C2410C" }} />
            <span><strong>28% Conversion rate</strong> on abandoned inquiries</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#C2410C" }} />
            <span><strong>100% Automated</strong> handling of re-scheduling and special requests</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> Dietary preference capture, deposit links for peak nights,
            no-show reduction sequences, waitlist automation, post-visit review requests, and “VIP guest” tagging.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Warm host. Polite, fast, detail-oriented, and service-first.
          </p>
        </div>
      </>
    ),
    messages: [
      { type: "agent", sender: "Jennifer", content: "Hi Steve, Jennifer from Dragon Wok Kitchen here.\n\nYou emailed us recently about booking a table. Are you still looking to reserve?", time: "11:00 AM" },
      { type: "system", content: "Lead engaged", id: "rb-1" },
      { type: "user", sender: "Steve", content: "Yes that was me", time: "11:05 AM" },
      { type: "user", sender: "Steve", content: "it was about 2 weeks ago I think", time: "11:05 AM" },
      { type: "system", content: "Lead replied", id: "rb-2" },
      { type: "agent", sender: "Jennifer", content: "Perfect, thanks.\n\nIs this for a special occasion, or a normal dinner?", time: "11:06 AM" },
      { type: "user", sender: "Steve", content: "wifes birthday is coming up", time: "11:15 AM" },
      { type: "user", sender: "Steve", content: "thought your venue could be nice", time: "11:15 AM" },
      { type: "agent", sender: "Jennifer", content: "That’s lovely 🙂\n\nWhat day were you thinking, and how many people?", time: "11:16 AM" },
      { type: "user", sender: "Steve", content: "Thursday", time: "11:25 AM" },
      { type: "user", sender: "Steve", content: "just the two of us", time: "11:25 AM" },
      { type: "agent", sender: "Jennifer", content: "Perfect.\n\nWe can do a small birthday touch, like dessert with a candle. Would you like that?", time: "11:26 AM" },
      { type: "user", sender: "Steve", content: "yes please", time: "11:35 AM" },
      { type: "system", content: "Lead qualified", id: "rb-3" },
      { type: "agent", sender: "Jennifer", content: "Done.\n\nHere’s the booking link to choose your time: https://calendar.app.google/uvWx5JWm7SLZSCqz7", time: "11:36 AM" },
      { type: "system", content: "Appointment booked 📅", id: "rb-4" },
      { type: "agent", sender: "Jennifer", content: "Great, you’re confirmed.\n\nAnything else you want us to know, like allergies or a quieter table?", time: "11:46 AM" },
      { type: "user", sender: "Steve", content: "no thats all thanks", time: "12:00 PM" },
      { type: "user", sender: "Steve", content: "oh by the way", time: "12:10 PM" },
      { type: "user", sender: "Steve", content: "I have to pick up my kid at that time. can I book another time?", time: "12:10 PM" },
      { type: "system", content: "Handling reschedule", id: "rb-5" },
      { type: "agent", sender: "Jennifer", content: "Of course, no problem.\n\nWhat time on Thursday works better?", time: "12:11 PM" },
      { type: "user", sender: "Steve", content: "5pm works", time: "12:20 PM" },
      { type: "agent", sender: "Jennifer", content: "Perfect, I moved it to 5:00 PM.\n\nIf anything changes again, just message me here.", time: "12:21 PM" },
      { type: "system", content: "Appointment booked 📅", id: "rb-6" },
      { type: "user", sender: "Steve", content: "thanks for the flexibility", time: "12:30 PM" },
      { type: "agent", sender: "Jennifer", content: "My pleasure, Steve. See you soon!", time: "12:31 PM" },
      { type: "system", content: "Closed", id: "rb-7" },
    ],
  },

  {
    id: 1,
    title: "Solar Panel",
    color: "#10B981",
    darkColor: "#047857",
    icon: <Sun className="w-6 h-6" />,
    leadFullName: "James Walker",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 1 - <span style={{ color: "#047857" }}>Solar Panel Installation</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          This flow demonstrates how Lead Awaker reactivates quote-history leads and turns “maybe later” into a concrete next step.
          The AI starts with a low-friction identity check, then immediately guides the conversation into directed discovery (no easy opt-out).
          It quantifies the current pain, surfaces the technical constraint (north-facing roof), then positions the call as the fastest way
          to get a realistic payback range and design options.
        </p>

        <h3 className="font-semibold text-lg mb-4">Key Performance Indicators:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#047857" }} />
            <span><strong>12.5% Appointment rate</strong> from cold quote history</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#047857" }} />
            <span><strong>Zero manual intervention</strong> until the specialist call</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#047857" }} />
            <span><strong>Integrated Calendar sync</strong> for instant booking</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> Photo collection of roof and meter, subsidy eligibility checks,
            automated pre-survey questionnaires, reminders to reduce no-show calls, and post-call follow-ups with personalized next steps.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Calm technical consultant. Direct, enthusiastic, and keeps momentum toward a booked assessment.
          </p>
        </div>
      </>
    ),
    messages: [
      {
        type: "agent",
        sender: "Michael",
        content: "Hi James, Michael from Aviax Solar here. Quick check, is this the James who asked us for a solar estimate a while ago? 🙂",
        time: "09:15 AM",
      },
      { type: "system", content: "Lead engaged", id: "sol-1" },

      // lead second answer updated
      { type: "user", sender: "James", content: "Yes I am James", time: "09:22 AM" },
      { type: "system", content: "Lead replied", id: "sol-2" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Thanks James. My manager asked me to follow up, but I didn’t want to spam you.\n\nAre you still aiming to reduce your monthly electricity cost this year?",
        time: "09:23 AM",
      },

      { type: "user", sender: "James", content: "yes, I am still looking", time: "09:35 AM" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Perfect.\n\nRoughly what are you paying per month right now, and has it increased over the last year?",
        time: "09:36 AM",
      },

      { type: "user", sender: "James", content: "about 200 euros", time: "09:42 AM" },
      { type: "user", sender: "James", content: "yeah it went up", time: "09:42 AM" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "That adds up fast.\n\nIf rates keep creeping up, what happens to your costs over the next 2 to 3 years if nothing changes?",
        time: "09:43 AM",
      },

      { type: "user", sender: "James", content: "it will probably get worse", time: "09:55 AM" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Exactly.\n\nOne technical detail decides whether solar works in your case. Is your main roof section north-facing, south-facing, or mixed?",
        time: "09:56 AM",
      },

      { type: "user", sender: "James", content: "north facing", time: "10:05 AM" },
      { type: "user", sender: "James", content: "so I doubt it pays back", time: "10:05 AM" },

      { type: "system", content: "Handling objection", id: "sol-3" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Totally fair.\n\nMost people assume north-facing means “no,” but pitch, shading, usable roof area, and whether we can use east or west sections can change the math.",
        time: "10:06 AM",
      },

      { type: "user", sender: "James", content: "oh I didnt know that", time: "10:10 AM" },

      // USP personalization added when asking for the call
      {
        type: "agent",
        sender: "Michael",
        content:
          "What we’re really good at is personalization—matching panel layout and assumptions to your exact roof and usage so the payback estimate is realistic.\n\nIf we could confirm in 10 minutes whether you can hit a payback you feel good about, would that be worth it?",
        time: "10:07 AM",
      },

      { type: "user", sender: "James", content: "maybe", time: "10:15 AM" },
      { type: "user", sender: "James", content: "can you reassure it pays back in less than 10 years?", time: "10:15 AM" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Good question.\n\nI can’t responsibly promise a number in chat without modeling your roof and tariff, but our specialist can give you a realistic range and tell you whether under 10 years is achievable for your setup.\n\nDo you have 10 minutes on a call to run through your roof and usage quickly?",
        time: "10:16 AM",
      },

      { type: "system", content: "Lead qualified", id: "sol-4" },

      { type: "user", sender: "James", content: "I see, it does make sense", time: "10:25 AM" },

      { type: "agent", sender: "Michael", content: "Great.\n\nHere’s the booking link: https://calendar.app.google/uvWx5JWm7SLZSCqz7", time: "10:26 AM" },

      { type: "system", content: "Appointment booked 📅", id: "sol-5" },

      {
        type: "agent",
        sender: "Michael",
        content:
          "Perfect James, you’re booked for Monday at 11:00 ✅\n\nOur specialist will call you then to go through payback and your north-facing roof.",
        time: "10:35 AM",
      },

      { type: "user", sender: "James", content: "Thanks Michael", time: "10:40 AM" },

      // separate final message AFTER thanks (as requested)
      { type: "agent", sender: "Michael", content: "You are welcome and have a good day 🙂", time: "10:41 AM" },
      { type: "system", content: "Closed", id: "sol-6" },
    ],
  },

  {
    id: 4,
    title: "Real Estate",
    color: "#6366F1",
    darkColor: "#4338CA",
    icon: <Building2 className="w-6 h-6" />,
    leadFullName: "Liam Carter",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 4 - <span style={{ color: "#4338CA" }}>Real Estate</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          Real estate leads often stall because the buyer can’t tell what is “normal” pricing and what is a bad deal.
          This AI flow restarts the conversation with a low-friction identity check, uses a natural excuse to re-open the thread,
          then qualifies the buyer’s timeline, criteria, and budget. It shares matching listings immediately, and escalates to a real agent
          once the buyer is comparing options. [web:143][web:144]
        </p>

        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#4338CA" }} />
            <span><strong>22% Engagement increase</strong> for 12+ month leads</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#4338CA" }} />
            <span><strong>Automated appraisal bookings</strong> synced with agent apps</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> Automated tour scheduling, automated contract and document sharing,
            listing alerts when new matches appear, price-drop notifications, and follow-ups that adapt to timeline changes.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Patient market guide. Calm, direct, and focused on moving the buyer from browsing to a decision.
          </p>
        </div>
      </>
    ),
    messages: [
      // FIXED: slow start like cases 1 and 2
      {
        type: "agent",
        sender: "Mia",
        content:
          "Hi Liam, Mia from HomeHaven Realty here. Quick check—are you the Liam who inquired a while back about beach-area properties? 🙂",
        time: "10:00 AM",
      },
      { type: "system", content: "Lead engaged", id: "re-1" },

      { type: "user", sender: "Liam", content: "yes thats me", time: "10:10 AM" },
      { type: "system", content: "Lead replied", id: "re-2" },

      {
        type: "agent",
        sender: "Mia",
        content:
          "Just circling back because I didn't want your request to fall through the cracks. Are you still looking to buy in the beach area?",
        time: "10:11 AM",
      },

      { type: "user", sender: "Liam", content: "still looking but carefully", time: "10:20 AM" },

      { type: "agent", sender: "Mia", content: "Got it.\n\nTo narrow this fast, are you looking to buy within 6 months, or is the timeline flexible?", time: "10:21 AM" },

      { type: "user", sender: "Liam", content: "within 6 months ideally", time: "10:30 AM" },

      { type: "agent", sender: "Mia", content: "Great.\n\nWhat are your top 3 must-haves? For example: distance to beach, bedrooms, and security.", time: "10:31 AM" },

      { type: "user", sender: "Liam", content: "close to beach", time: "10:40 AM" },
      { type: "user", sender: "Liam", content: "2 bedrooms", time: "10:40 AM" },
      { type: "user", sender: "Liam", content: "good security", time: "10:40 AM" },

      { type: "agent", sender: "Mia", content: "Perfect.\n\nWhat budget are you aiming for so we don’t waste time on listings that won’t fit?", time: "10:41 AM" },

      { type: "user", sender: "Liam", content: "around 200k euros", time: "10:50 AM" },
      { type: "user", sender: "Liam", content: "but I dont want to overpay", time: "10:50 AM" },

      { type: "system", content: "Handling objection", id: "re-3" },

      { type: "agent", sender: "Mia", content: "Makes sense.\n\nHere’s a shortlist of current listings that match your criteria so you can see real options:\nhttps://homehaven.example/listings?near=beach&beds=2&security=high&max=200000", time: "10:51 AM" },

      { type: "user", sender: "Liam", content: "ok I see them", time: "11:00 AM" },
      { type: "user", sender: "Liam", content: "im unsure between Marina View and Sandgate Residences", time: "11:00 AM" },

      { type: "agent", sender: "Mia", content: "That’s a good place to be.\n\nTo avoid a costly mistake, the next step is a short call with our real agent to compare fees, recent sales nearby, and negotiation room.\n\nWant to book that comparison call now?", time: "11:01 AM" },

      { type: "system", content: "Lead qualified", id: "re-4" },

      { type: "user", sender: "Liam", content: "yes please", time: "11:10 AM" },

      { type: "agent", sender: "Mia", content: "Perfect.\n\nBook a slot here: https://calendar.app.google/uvWx5JWm7SLZSCqz7", time: "11:11 AM" },

      { type: "system", content: "Appointment booked 📅", id: "re-5" },

      { type: "agent", sender: "Mia", content: "Great Liam, you’re booked for Wednesday at 16:00 ✅\n\nYour agent will be John Mayer. He’s friendly and very strong on beach-area pricing, negotiation, and spotting hidden costs like HOA fees.\n\nSee you Wednesday 🙂", time: "11:20 AM" },

      { type: "user", sender: "Liam", content: "awesome thanks", time: "11:25 AM" },
      { type: "user", sender: "Liam", content: "looking forward to it", time: "11:25 AM" },

      { type: "agent", sender: "Mia", content: "Talk soon!", time: "11:26 AM" },
      { type: "system", content: "Closed", id: "re-6" },
    ],
  },

  {
    id: 5,
    title: "Health Clinic",
    color: "#E11D48",
    darkColor: "#BE123C",
    icon: <Globe className="w-6 h-6" />,
    leadFullName: "Daniel Reed",
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          Case 5 - <span style={{ color: "#BE123C" }}>Health Clinic</span>
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          In healthcare, leads drop because it feels overwhelming and personal. This AI flow reactivates the lead gently,
          collects just enough context to route them correctly, answers a final question about services, and locks the consult.
          It sets expectations that the specialist will assess nutrition first and also check whether other integrative care is needed.
        </p>

        <h3 className="font-semibold text-lg mb-4">Key Metrics:</h3>
        <ul className="space-y-2 mb-8">
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#BE123C" }} />
            <span><strong>31% Appointment rate</strong> for chronic symptom leads</span>
          </li>
          <li className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#BE123C" }} />
            <span><strong>100% Automated</strong> symptom qualification and triage</span>
          </li>
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <strong>Additional use cases for this niche:</strong> Intake forms, reminder sequences, pre-visit instructions,
            post-visit follow-ups, care-plan check-ins, and routing urgent symptoms to faster care pathways.
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <strong>Agent Speech Profile:</strong> Calm clinical coordinator. Warm, minimal, and focused on getting the patient to the right professional.
          </p>
        </div>
      </>
    ),
    messages: [
      { type: "agent", sender: "Marcia", content: "Hi Daniel, Marcia from Holistica Balance Center here 🙂\n\nI’m glad to reconnect. Are you still looking for support with the consultation you asked about?", time: "02:00 PM" },
      { type: "system", content: "Lead engaged", id: "hc-1" },
      { type: "user", sender: "Daniel", content: "yes indeed", time: "02:05 PM" },
      { type: "system", content: "Lead replied", id: "hc-2" },
      { type: "agent", sender: "Marcia", content: "Thanks.\n\nWhat is the main issue you want help with right now?", time: "02:06 PM" },
      { type: "user", sender: "Daniel", content: "severe heartburn", time: "02:15 PM" },
      { type: "user", sender: "Daniel", content: "im done with it", time: "02:15 PM" },
      { type: "agent", sender: "Marcia", content: "That sounds really uncomfortable.\n\nQuick check: how long has it been going on, and any trouble swallowing or vomiting?", time: "02:16 PM" },
      { type: "user", sender: "Daniel", content: "long time", time: "02:25 PM" },
      { type: "user", sender: "Daniel", content: "no vomiting", time: "02:25 PM" },
      { type: "agent", sender: "Marcia", content: "Ok.\n\nHave you noticed food triggers, and have you tried anything that helped?", time: "02:26 PM" },
      { type: "user", sender: "Daniel", content: "I think its FODMAPs", time: "02:35 PM" },
      { type: "user", sender: "Daniel", content: "avoiding helps but it still happens", time: "02:35 PM" },
      { type: "agent", sender: "Marcia", content: "Got it.\n\nWould you like to book an in-person consult so our specialist Nutritionist can review your case and set a plan? They will also assess if you need other integrative care.", time: "02:36 PM" },
      { type: "system", content: "Conversation followed up", id: "hc-followup-1" },
      { type: "agent", sender: "Marcia", content: "Just checking in Daniel, do you want me to send the booking link?", time: "03:36 PM" },
      { type: "user", sender: "Daniel", content: "sorry got busy", time: "02:55 PM" },
      { type: "user", sender: "Daniel", content: "yes lets do it", time: "02:55 PM" },
      { type: "system", content: "Lead qualified", id: "hc-3" },
      { type: "agent", sender: "Marcia", content: "Perfect.\n\nBook here: https://calendar.app.google/uvWx5JWm7SLZSCqz7", time: "02:56 PM" },
      { type: "system", content: "Appointment booked 📅", id: "hc-4" },
      { type: "agent", sender: "Marcia", content: "All set Daniel, you’re booked for Monday at 16:00 ✅\n\nQuick question before you go: do you offer food intolerance tests, or is it only nutrition guidance?", time: "03:05 PM" },
      { type: "user", sender: "Daniel", content: "yeah thats what I wanted to ask", time: "03:10 PM" },
      { type: "agent", sender: "Marcia", content: "Yes, we do offer testing options.\n\nYour Nutritionist will explain what makes sense for your symptoms and whether it is better to test before or after the first consult.", time: "03:11 PM" },
      { type: "user", sender: "Daniel", content: "perfect thanks", time: "03:12 PM" },
      { type: "agent", sender: "Marcia", content: "You are welcome and have a good day 🙂", time: "03:13 PM" },
      { type: "system", content: "Closed", id: "hc-5" },
    ],
  },
].sort((a, b) => a.id - b.id);

export default function Services() {
  const [activeCase, setActiveCase] = useState(0);

  return (
    <div className="min-h-screen pt-24 pb-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-0">
        <div className="max-w-4xl mx-auto text-center mb-16 px-0">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
          >
            Real Use Cases
          </motion.h1>
          <p className="text-xl text-slate-600 whitespace-nowrap">
            Select a case study below to see how our AI handles different industries and use cases.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-nowrap justify-between gap-4 px-4 md:px-0 mt-[20px] mb-[20px]">
          {CASES.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActiveCase(index)}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 min-w-0 flex-1 relative overflow-hidden ${
                activeCase === index
                  ? "bg-white shadow-xl scale-105 z-10"
                  : "bg-white/50 border-slate-200 hover:border-slate-300 grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
              }`}
              style={
                activeCase === index
                  ? { borderColor: item.color, boxShadow: `0 20px 25px -5px ${item.color}15` }
                  : {}
              }
            >
              <div
                className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
                style={{
                  background:
                    activeCase === index
                      ? `linear-gradient(to top left, ${item.color}10, transparent)`
                      : `linear-gradient(to top left, #94a3b810, transparent)`,
                  opacity: 1,
                }}
              />

              <span
                className="text-sm font-bold uppercase tracking-wider mb-2 relative z-10"
                style={{ color: activeCase === index ? item.color : "#64748b" }}
              >
                Case {item.id}
              </span>

              <div className="mb-3 relative z-10" style={{ color: activeCase === index ? item.color : "#94a3b8" }}>
                {item.icon}
              </div>

              <span className={`font-bold text-center leading-tight relative z-10 ${activeCase === index ? "text-slate-900" : "text-slate-500"}`}>
                {item.title}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 mx-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCase}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-2 gap-12 items-start"
            >
              <div className="order-1">
                {CASES[activeCase].description}
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <p className="text-slate-500 text-sm italic">
                    Note: This interaction is handled 100% by Lead Awaker AI. No human intervention required until intent is confirmed.
                  </p>
                </div>
              </div>

              <div className="order-2 max-w-md mx-auto lg:mx-0 w-full lg:sticky lg:top-8">
                <div className="relative">
                  <div
                    className="absolute -inset-4 rounded-[2.5rem] blur-2xl -z-10"
                    style={{ backgroundColor: `${CASES[activeCase].color}10` }}
                  />
                  <ChatCard2D
                    messages={CASES[activeCase].messages}
                    themeColor={CASES[activeCase].color}
                    // @ts-ignore - implement in ChatCard2D header
                    leadFullName={CASES[activeCase].leadFullName}
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-24 text-center">
          <Link href="/book-demo">
            <Button
              size="lg"
              className="h-20 px-12 text-lg rounded-2xl shadow-xl transition-transform hover:scale-105"
              style={{
                backgroundColor: CASES[activeCase].color,
                boxShadow: `0 10px 15px -3px ${CASES[activeCase].color}40`,
              }}
            >
              Apply to Your Business
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
