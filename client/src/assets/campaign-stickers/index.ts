/**
 * Campaign Sticker Manifest
 *
 * SVGRepo "Action Bordered Tritone Vectors" collection (44 icons)
 * https://www.svgrepo.com/collection/action-bordered-tritone-vectors/
 *
 * Each entry: { slug, label, url }
 * - slug: filename without extension (must match the .svg filename exactly)
 * - label: human-readable name shown in the picker tooltip
 * - url: resolved at build time via Vite's import.meta.url
 *
 * The hue-rotate filter works on whatever colors are embedded in the SVG.
 */

export interface CampaignSticker {
  slug: string;
  label: string;
  url: string;
}

// ── Imports ───────────────────────────────────────────────────────────────────
import addWalletUrl from "./add-wallet-svgrepo-com.svg?url";
import apiUrl from "./api-svgrepo-com.svg?url";
import awardUrl from "./award-svgrepo-com.svg?url";
import brandUrl from "./brand-svgrepo-com.svg?url";
import brushUrl from "./brush-svgrepo-com.svg?url";
import careerGrowthUrl from "./career-growth-svgrepo-com.svg?url";
import cartUrl from "./cart-svgrepo-com.svg?url";
import codeMobileUrl from "./code-mobile-svgrepo-com.svg?url";
import creativity1Url from "./creativity-1-svgrepo-com.svg?url";
import creativityUrl from "./creativity-svgrepo-com.svg?url";
import diagramUrl from "./diagram-svgrepo-com.svg?url";
import digitalMarketing1Url from "./digital-marketing-1-svgrepo-com.svg?url";
import digitalMarketingUrl from "./digital-marketing-svgrepo-com.svg?url";
import folderUrl from "./folder-svgrepo-com.svg?url";
import globalUrl from "./global-svgrepo-com.svg?url";
import layoutsUrl from "./layouts-svgrepo-com.svg?url";
import mobileFeaturesUrl from "./mobile-features-svgrepo-com.svg?url";
import multiSelectUrl from "./multi-select-svgrepo-com.svg?url";
import nftPictureUrl from "./nft-picture-svgrepo-com.svg?url";
import nftUrl from "./nft-svgrepo-com.svg?url";
import objectUrl from "./object-svgrepo-com.svg?url";
import partnersUrl from "./partners-svgrepo-com.svg?url";
import penToolUrl from "./pen-tool-svgrepo-com.svg?url";
import piechartUrl from "./piechart-svgrepo-com.svg?url";
import puzzleUrl from "./puzzle-svgrepo-com.svg?url";
import responsiveUrl from "./responsive-svgrepo-com.svg?url";
import retryUrl from "./retry-svgrepo-com.svg?url";
import rocketPencilUrl from "./rocket-pencil-svgrepo-com.svg?url";
import safeMoneyUrl from "./safe-money-svgrepo-com.svg?url";
import safePasswordUrl from "./safe-password-svgrepo-com.svg?url";
import searchDocumentUrl from "./search-document-svgrepo-com.svg?url";
import searchUrl from "./search-svgrepo-com.svg?url";
import securityUrl from "./security-svgrepo-com.svg?url";
import settingsUrl from "./settings-svgrepo-com.svg?url";
import statistics1Url from "./statistics-1-svgrepo-com.svg?url";
import statisticsUrl from "./statistics-svgrepo-com.svg?url";
import stickerSmileUrl from "./sticker-smile-svgrepo-com.svg?url";
import styleUrl from "./style-svgrepo-com.svg?url";
import tickUrl from "./tick-svgrepo-com.svg?url";
import timerUrl from "./timer-svgrepo-com.svg?url";
import uxMobileUrl from "./ux-mobile-svgrepo-com.svg?url";
import webSelectUrl from "./web-select-svgrepo-com.svg?url";
import webSpeedUrl from "./web-speed-svgrepo-com.svg?url";
import webUrl from "./web-svgrepo-com.svg?url";

// ── Sticker registry ──────────────────────────────────────────────────────────
export const CAMPAIGN_STICKERS: CampaignSticker[] = [
  { slug: "add-wallet-svgrepo-com",       label: "Add Wallet",        url: addWalletUrl },
  { slug: "api-svgrepo-com",              label: "API",               url: apiUrl },
  { slug: "award-svgrepo-com",            label: "Award",             url: awardUrl },
  { slug: "brand-svgrepo-com",            label: "Brand",             url: brandUrl },
  { slug: "brush-svgrepo-com",            label: "Brush",             url: brushUrl },
  { slug: "career-growth-svgrepo-com",    label: "Career Growth",     url: careerGrowthUrl },
  { slug: "cart-svgrepo-com",             label: "Cart",              url: cartUrl },
  { slug: "code-mobile-svgrepo-com",      label: "Code Mobile",       url: codeMobileUrl },
  { slug: "creativity-1-svgrepo-com",     label: "Creativity Alt",    url: creativity1Url },
  { slug: "creativity-svgrepo-com",       label: "Creativity",        url: creativityUrl },
  { slug: "diagram-svgrepo-com",          label: "Diagram",           url: diagramUrl },
  { slug: "digital-marketing-1-svgrepo-com", label: "Digital Marketing Alt", url: digitalMarketing1Url },
  { slug: "digital-marketing-svgrepo-com",   label: "Digital Marketing",     url: digitalMarketingUrl },
  { slug: "folder-svgrepo-com",           label: "Folder",            url: folderUrl },
  { slug: "global-svgrepo-com",           label: "Global",            url: globalUrl },
  { slug: "layouts-svgrepo-com",          label: "Layouts",           url: layoutsUrl },
  { slug: "mobile-features-svgrepo-com",  label: "Mobile Features",   url: mobileFeaturesUrl },
  { slug: "multi-select-svgrepo-com",     label: "Multi Select",      url: multiSelectUrl },
  { slug: "nft-picture-svgrepo-com",      label: "NFT Picture",       url: nftPictureUrl },
  { slug: "nft-svgrepo-com",              label: "NFT",               url: nftUrl },
  { slug: "object-svgrepo-com",           label: "Object",            url: objectUrl },
  { slug: "partners-svgrepo-com",         label: "Partners",          url: partnersUrl },
  { slug: "pen-tool-svgrepo-com",         label: "Pen Tool",          url: penToolUrl },
  { slug: "piechart-svgrepo-com",         label: "Pie Chart",         url: piechartUrl },
  { slug: "puzzle-svgrepo-com",           label: "Puzzle",            url: puzzleUrl },
  { slug: "responsive-svgrepo-com",       label: "Responsive",        url: responsiveUrl },
  { slug: "retry-svgrepo-com",            label: "Retry",             url: retryUrl },
  { slug: "rocket-pencil-svgrepo-com",    label: "Rocket Pencil",     url: rocketPencilUrl },
  { slug: "safe-money-svgrepo-com",       label: "Safe Money",        url: safeMoneyUrl },
  { slug: "safe-password-svgrepo-com",    label: "Safe Password",     url: safePasswordUrl },
  { slug: "search-document-svgrepo-com",  label: "Search Document",   url: searchDocumentUrl },
  { slug: "search-svgrepo-com",           label: "Search",            url: searchUrl },
  { slug: "security-svgrepo-com",         label: "Security",          url: securityUrl },
  { slug: "settings-svgrepo-com",         label: "Settings",          url: settingsUrl },
  { slug: "statistics-1-svgrepo-com",     label: "Statistics Alt",    url: statistics1Url },
  { slug: "statistics-svgrepo-com",       label: "Statistics",        url: statisticsUrl },
  { slug: "sticker-smile-svgrepo-com",    label: "Sticker Smile",     url: stickerSmileUrl },
  { slug: "style-svgrepo-com",            label: "Style",             url: styleUrl },
  { slug: "tick-svgrepo-com",             label: "Tick",              url: tickUrl },
  { slug: "timer-svgrepo-com",            label: "Timer",             url: timerUrl },
  { slug: "ux-mobile-svgrepo-com",        label: "UX Mobile",         url: uxMobileUrl },
  { slug: "web-select-svgrepo-com",       label: "Web Select",        url: webSelectUrl },
  { slug: "web-speed-svgrepo-com",        label: "Web Speed",         url: webSpeedUrl },
  { slug: "web-svgrepo-com",              label: "Web",               url: webUrl },
];
