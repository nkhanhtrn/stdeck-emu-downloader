import {
  PanelSection,
  staticClasses
} from "@decky/ui";
import {
  definePlugin
} from "@decky/api"
import { FaDownload } from "react-icons/fa";

function Content() {
  return (
    <PanelSection title="ROM Downloader">
      <div style={{ padding: "20px", textAlign: "center" }}>
        ROM Downloader is ready!
      </div>
    </PanelSection>
  );
};

export default definePlugin(() => {
  console.log("ROM Downloader plugin initializing");

  return {
    name: "ROM Downloader",
    titleView: <div className={staticClasses.Title}>ROM Downloader</div>,
    content: <Content />,
    icon: <FaDownload />,
    onDismount() {
      console.log("ROM Downloader unmounting");
    },
  };
});
