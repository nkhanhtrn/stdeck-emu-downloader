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

const LOCAL_STORAGE_KEY_CONSOLE = 'console';
const LOCAL_STORAGE_KEY_INPUT = 'input';

function getInitialState<T>(key: string, defaultValue: T, property: string): T {
  const settingsString = localStorage.getItem(key);
  if (!settingsString) {
    return defaultValue;
  }
  try {
    const storedSettings = JSON.parse(settingsString);
    return storedSettings[property] ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveState<T>(key: string, value: T, property: string) {
  localStorage.setItem(key, JSON.stringify({ [property]: value }));
}

function Content() {
  const [selectedOption, setSelectedOption] = useState<any>(() => {
    const savedId = getInitialState<string>(LOCAL_STORAGE_KEY_CONSOLE, 'gba', 'value');
    return CONSOLE_OPTIONS.find(opt => opt.data === savedId) || CONSOLE_OPTIONS[0];
  });
  const [inputValue, setInputValue] = useState<string>(() => getInitialState(LOCAL_STORAGE_KEY_INPUT, '', 'value'));

  return (
    <PanelSection title="ROM Downloader">
      <PanelSectionRow>
        <Dropdown
          selectedOption={selectedOption}
          rgOptions={CONSOLE_OPTIONS}
          onChange={(option) => {
            setSelectedOption(option);
            saveState(LOCAL_STORAGE_KEY_CONSOLE, option.data, 'value');
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            saveState(LOCAL_STORAGE_KEY_INPUT, e.target.value, 'value');
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
