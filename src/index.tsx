import {
  PanelSection,
  PanelSectionRow,
  Dropdown,
  TextField,
  ButtonItem,
  staticClasses
} from "@decky/ui";
import {
  definePlugin,
  call,
  openFilePicker,
  FileSelectionType
} from "@decky/api"
import { FaDownload, FaFolderOpen } from "react-icons/fa";
import { useState, useEffect } from "react";

const CONSOLE_OPTIONS = [
  { data: "gba", label: "Game Boy Advance" },
  { data: "nes", label: "Nintendo" },
];

const LOCAL_STORAGE_KEY_CONSOLE = 'console';
const LOCAL_STORAGE_KEY_FOLDER = 'folder';

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

interface RomEntry {
  name: string;
  url: string;
  size: string;
}

function Content() {
  const [selectedValue, setSelectedValue] = useState<string>(() => {
    return getInitialState<string>(LOCAL_STORAGE_KEY_CONSOLE, 'gba', 'value');
  });
  const [downloadFolder, setDownloadFolder] = useState<string>(() => {
    return getInitialState<string>(LOCAL_STORAGE_KEY_FOLDER, '', 'value');
  });

  const [romList, setRomList] = useState<RomEntry[]>([]);
  const [filteredRomList, setFilteredRomList] = useState<RomEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load ROM list on mount
  useEffect(() => {
    const loadRoms = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result: any = await call("get_rom_list");
        if (result.success) {
          setRomList(result.roms || []);
          setFilteredRomList(result.roms || []);
        } else {
          setError(result.error || "Failed to load ROM list");
        }
      } catch (err) {
        setError(`Error: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadRoms();
  }, []);

  // Filter ROMs based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRomList([]);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRomList(
        romList.filter(rom =>
          rom.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, romList]);

  return (
    <>
      <PanelSection title="Settings">
        <PanelSectionRow>
          <Dropdown
            selectedOption={selectedValue}
            rgOptions={CONSOLE_OPTIONS}
            onChange={(option) => {
              setSelectedValue(option.data);
              saveState(LOCAL_STORAGE_KEY_CONSOLE, option.data, 'value');
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <TextField
              label="Download Folder"
              value={downloadFolder}
              onChange={(e) => {
                setDownloadFolder(e.target.value);
                saveState(LOCAL_STORAGE_KEY_FOLDER, e.target.value, 'value');
              }}
              style={{ flex: 1 }}
            />
            <ButtonItem
              layout="inline"
              onClick={async () => {
                try {
                  const result = await openFilePicker(
                    FileSelectionType.FOLDER,
                    downloadFolder || '/home/deck'
                  );
                  if (result.path) {
                    setDownloadFolder(result.path);
                    saveState(LOCAL_STORAGE_KEY_FOLDER, result.path, 'value');
                  }
                } catch (err) {
                  console.error('Folder picker error:', err);
                }
              }}
            >
              <FaFolderOpen />
            </ButtonItem>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Search ROMs">
        <PanelSectionRow>
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection
        title={`Results${filteredRomList.length > 0 ? ` (${filteredRomList.length})` : ''}`}
        spinner={isLoading}
      >
        {error && (
          <PanelSectionRow>
            <div style={{ color: '#ff6b6b', padding: '10px' }}>
              {error}
            </div>
          </PanelSectionRow>
        )}

        {!isLoading && !searchQuery && (
          <PanelSectionRow>
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              Type to search for ROMs
            </div>
          </PanelSectionRow>
        )}

        {!isLoading && searchQuery && filteredRomList.length === 0 && !error && (
          <PanelSectionRow>
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              No ROMs match your search
            </div>
          </PanelSectionRow>
        )}

        {searchQuery && filteredRomList.length > 0 && (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredRomList.slice(0, 100).map(rom => (
              <PanelSectionRow key={rom.name}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                  onClick={() => console.log('Download:', rom.name)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'white'
                    }}>
                      {rom.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {rom.size}
                    </div>
                  </div>
                </div>
              </PanelSectionRow>
            ))}
            {filteredRomList.length > 100 && (
              <PanelSectionRow>
                <div style={{
                  padding: '10px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '12px'
                }}>
                  Showing 100 of {filteredRomList.length} ROMs.<br />
                  Try a more specific search.
                </div>
              </PanelSectionRow>
            )}
          </div>
        )}
      </PanelSection>
    </>
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
