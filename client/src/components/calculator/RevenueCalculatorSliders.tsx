import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, Receipt } from "lucide-react";
import { sliderPct } from "./useRevenueCalculator";

interface Props {
  leads: number;
  setLeads: (v: number) => void;
  dealValue: number;
  setDealValue: (v: number) => void;
  costPerLead: number;
  setCostPerLead: (v: number) => void;
  currencySymbol: string;
  dealConfig: { min: number; max: number; step: number; default: number };
  costConfig: { min: number; max: number; step: number; default: number };
  editingLeads: boolean;
  setEditingLeads: (v: boolean) => void;
  leadsInput: string;
  setLeadsInput: (v: string) => void;
  editingDeal: boolean;
  setEditingDeal: (v: boolean) => void;
  dealInput: string;
  setDealInput: (v: string) => void;
  editingCost: boolean;
  setEditingCost: (v: boolean) => void;
  costInput: string;
  setCostInput: (v: string) => void;
}

export function RevenueCalculatorSliders({
  leads, setLeads, dealValue, setDealValue, costPerLead, setCostPerLead,
  currencySymbol, dealConfig, costConfig,
  editingLeads, setEditingLeads, leadsInput, setLeadsInput,
  editingDeal, setEditingDeal, dealInput, setDealInput,
  editingCost, setEditingCost, costInput, setCostInput,
}: Props) {
  const { t } = useTranslation("home");

  return (
    <motion.div layout className="flex flex-col gap-4 w-full md:w-[368px] shrink-0">
      {/* Leads */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ delay: 0.05 }}
        className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <label className="font-heading font-bold text-lg">{t("calculator.leadsLabel")}</label>
        </div>
        {editingLeads ? (
          <input
            type="number" autoFocus value={leadsInput}
            onChange={(e) => setLeadsInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(leadsInput, 10);
              if (!isNaN(n) && n > 0) setLeads(n);
              setEditingLeads(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            className="text-4xl font-bold font-heading text-[#4F46E5] mb-4 w-full bg-transparent outline-none"
          />
        ) : (
          <div
            className="text-4xl font-bold font-heading text-[#4F46E5] mb-4 cursor-text hover:opacity-70 transition-opacity"
            onClick={() => { setLeadsInput(String(leads)); setEditingLeads(true); }}
            title="Click to type"
          >
            {leads.toLocaleString()}
          </div>
        )}
        <input
          type="range" min={500} max={50000} step={500}
          value={Math.min(Math.max(leads, 500), 50000)}
          onChange={(e) => setLeads(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #4F46E5 ${sliderPct(Math.min(Math.max(leads, 500), 50000), 500, 50000)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(leads, 500), 50000), 500, 50000)}%)` }}
        />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>500</span><span>50,000</span>
        </div>
      </motion.div>

      {/* Deal Value */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ delay: 0.1 }}
        className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#FEB800]/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-[#FEB800]" />
          </div>
          <label className="font-heading font-bold text-lg">{t("calculator.dealLabel")}</label>
        </div>
        {editingDeal ? (
          <input
            type="number" autoFocus value={dealInput}
            onChange={(e) => setDealInput(e.target.value)}
            onBlur={() => {
              const n = parseFloat(dealInput);
              if (!isNaN(n) && n > 0) setDealValue(n);
              setEditingDeal(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            className="text-4xl font-bold font-heading text-[#FEB800] mb-4 w-full bg-transparent outline-none"
          />
        ) : (
          <div
            className="text-4xl font-bold font-heading text-[#FEB800] mb-4 cursor-text hover:opacity-70 transition-opacity"
            onClick={() => { setDealInput(String(dealValue)); setEditingDeal(true); }}
            title="Click to type"
          >
            {currencySymbol}{dealValue.toLocaleString()}
          </div>
        )}
        <input
          type="range" min={dealConfig.min} max={dealConfig.max} step={dealConfig.step}
          value={Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max)}
          onChange={(e) => setDealValue(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #FEB800 ${sliderPct(Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max), dealConfig.min, dealConfig.max)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max), dealConfig.min, dealConfig.max)}%)` }}
        />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>{currencySymbol}{dealConfig.min.toLocaleString()}</span>
          <span>{currencySymbol}{dealConfig.max.toLocaleString()}</span>
        </div>
      </motion.div>

      {/* Cost Per Lead */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ delay: 0.15 }}
        className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5 text-[#ef4444]" />
          </div>
          <label className="font-heading font-bold text-lg">{t("calculator.costLabel")}</label>
        </div>
        {editingCost ? (
          <input
            type="number" autoFocus value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            onBlur={() => {
              const n = parseFloat(costInput);
              if (!isNaN(n) && n > 0) setCostPerLead(n);
              setEditingCost(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            className="text-4xl font-bold font-heading text-[#ef4444] mb-4 w-full bg-transparent outline-none"
          />
        ) : (
          <div
            className="text-4xl font-bold font-heading text-[#ef4444] mb-4 cursor-text hover:opacity-70 transition-opacity"
            onClick={() => { setCostInput(String(costPerLead)); setEditingCost(true); }}
            title="Click to type"
          >
            {currencySymbol}{costPerLead.toLocaleString()}
          </div>
        )}
        <input
          type="range" min={costConfig.min} max={costConfig.max} step={costConfig.step}
          value={Math.min(Math.max(costPerLead, costConfig.min), costConfig.max)}
          onChange={(e) => setCostPerLead(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #ef4444 ${sliderPct(Math.min(Math.max(costPerLead, costConfig.min), costConfig.max), costConfig.min, costConfig.max)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(costPerLead, costConfig.min), costConfig.max), costConfig.min, costConfig.max)}%)` }}
        />
        <div className="flex justify-between text-sm text-muted-foreground mt-2">
          <span>{currencySymbol}{costConfig.min}</span>
          <span>{currencySymbol}{costConfig.max}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
