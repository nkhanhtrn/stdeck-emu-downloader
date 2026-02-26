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

const STORAGE_KEY_CONSOLE = 'console';
const STORAGE_KEY_INPUT = 'input';

function getInitialState<T>(key: string, defaultValue: T): T {
  const settingsString = localStorage.getItem(key);
  if (!settingsString) {
    return defaultValue;
  }
  try {
    return JSON.parse(settingsString) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveState<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function Content() {
  const [selectedOption, setSelectedOption] = useState<any>(() => {
    const savedId = getInitialState<string>(STORAGE_KEY_CONSOLE, 'gba');
    return CONSOLE_OPTIONS.find(opt => opt.data === savedId) || CONSOLE_OPTIONS[0];
  });
  const [inputValue, setInputValue] = useState<string>(() => getInitialState(STORAGE_KEY_INPUT, ''));

  return (
    <PanelSection title="ROM Downloader">
      <PanelSectionRow>
        <Dropdown
          selectedOption={selectedOption}
          rgOptions={CONSOLE_OPTIONS}
          onChange={(option) => {
            setSelectedOption(option);
            saveState(STORAGE_KEY_CONSOLE, option.data);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            saveState(STORAGE_KEY_INPUT, e.target.value);
          }}
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
