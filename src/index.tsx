import {
  PanelSection,
  PanelSectionRow,
  Dropdown,
  TextField,
  staticClasses
} from "@decky/ui";
import {
  definePlugin
} from "@decky/api"
import { FaDownload } from "react-icons/fa";
import { useState } from "react";

const CONSOLE_OPTIONS = [
  { data: "gba", label: "Game Boy Advance" },
  { data: "nes", label: "Nintendo" },
];

function Content() {
  const [selectedOption, setSelectedOption] = useState<any>(CONSOLE_OPTIONS[0]);
  const [inputValue, setInputValue] = useState("");

  return (
    <PanelSection title="ROM Downloader">
      <PanelSectionRow>
        <Dropdown
          selectedOption={selectedOption}
          rgOptions={CONSOLE_OPTIONS}
          onChange={(option) => setSelectedOption(option)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </PanelSectionRow>
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
