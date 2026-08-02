// Shared section layout constants

const sectionWrap = {
  maxWidth: 1240, margin: "0 auto", padding: "144px 48px"
};
const sectionWrapMobile = {
  maxWidth: 1240, margin: "0 auto", padding: "84px 18px"
};
function getSectionWrap(isMobile) { return isMobile ? sectionWrapMobile : sectionWrap; }
