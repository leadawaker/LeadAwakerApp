// Types the Demos page and its routes share for a prospect: the settings a demo
// greets with, the DTO the panel reads, and the results of the prospect actions.
// Types only: nothing here ships code.
export type ProspectLang = "en" | "nl" | "pt";
export type AiDisclosure = "" | "off" | "opener" | "second_message";   // "" = campaign default
export type DemoMarket = "" | "uk" | "us" | "nl";                       // "" = language default; EN only

export interface DemoProspectSettings {
  firstName: string;
  companyName: string;
  clientNiche: string;
  language: ProspectLang;
  aiDisclosure: AiDisclosure;
  market: DemoMarket;
}

export interface DemoProspectDto extends DemoProspectSettings {
  prospectGroup: string;
  notes: string;
  websiteUrl: string;
  /** From the Client row (Niche_Vocabulary.screenshot_path), "" when none. */
  screenshot: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProspectSettingsResult {
  prospect: DemoProspectDto;
  updatedTokens: string[];
  failedTokens: { token: string; message: string }[];
}

export interface DemoDeleteResult {
  tokens: string[];
  leads: number;
  children: Record<string, number>;
}

export interface RemintResult {
  oldToken: string;
  token: string;
  demoUrl: string;
  whatsappUrl: string;
}
