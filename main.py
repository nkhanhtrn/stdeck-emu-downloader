import decky
import requests
from bs4 import BeautifulSoup
import os
import asyncio

# Set up logging to file
LOG_FILE = '/tmp/romdownloader.log'

def log(msg):
    """Write to log file"""
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 'sync'}] {msg}\n")
    decky.logger.info(msg)

class SimpleTerminal:
    def __init__(self, terminal_id: str, shell: str = None):
        self.id = terminal_id
        self.process = None
        self.buffer = []
        self.is_subscribed = False

        # Determine shell to use
        if shell is None:
            shell = os.environ.get('SHELL', '/bin/bash')

        self.shell = shell
        self.rows = 24
        self.cols = 80

        log(f"SimpleTerminal.__init__: id={terminal_id}, shell={shell}")

    async def start(self):
        """Start the terminal process"""
        import pty
        import struct
        import fcntl
        import termios

        log(f"start: Opening PTY for {self.id}")

        # Open PTY
        self.master_fd, self.slave_fd = pty.openpty()
        log(f"start: PTY opened master_fd={self.master_fd} slave_fd={self.slave_fd}")

        # Set terminal size
        winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
        fcntl.ioctl(self.slave_fd, termios.TIOCSWINSZ, winsize)
        log(f"start: Set window size to {self.rows}x{self.cols}")

        # Start shell process
        log(f"start: Creating subprocess for {self.shell}")
        self.process = await asyncio.create_subprocess_exec(
            self.shell,
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            env={
                "TERM": "xterm-256color",
                "PWD": os.environ.get("HOME", "/home/deck"),
                "HOME": os.environ.get("HOME", "/home/deck"),
                "SHELL": self.shell,
                "USER": os.environ.get("USER", "deck"),
            },
            preexec_fn=os.setsid,
        )
        log(f"start: Process created pid={self.process.pid}")

        # Start reading output
        log(f"start: Starting output loop")
        asyncio.create_task(self._read_output_loop())
        log(f"start: Output loop task created")

    async def _read_output_loop(self):
        """Read output from PTY and broadcast to subscribers"""
        import os
        log(f"_read_output_loop: Starting for {self.id}")

        loop_count = 0
        while self.process and self.process.returncode is None:
            try:
                loop_count += 1
                log(f"_read_output_loop: Reading data (loop #{loop_count})")
                data = await asyncio.to_thread(os.read, self.master_fd, 4096)
                log(f"_read_output_loop: Got {len(data) if data else 0} bytes")
                if data:
                    output = data.decode('utf-8', errors='ignore')
                    self.buffer.append(output)
                    log(f"_read_output_loop: Buffer size now {len(self.buffer)}")
                    if self.is_subscribed:
                        log(f"_read_output_loop: Emitting to terminal_output#{self.id}")
                        await decky.emit(f"terminal_output#{self.id}", output)
                        log(f"_read_output_loop: Emitted successfully")
                    else:
                        log(f"_read_output_loop: Not subscribed, not emitting")
            except Exception as e:
                log(f"_read_output_loop: Exception: {e}")
                import traceback
                log(f"_read_output_loop: Traceback: {traceback.format_exc()}")
                break
            await asyncio.sleep(0.01)

        log(f"_read_output_loop: Loop ended, returncode={self.process.returncode if self.process else 'No process'}")

    def write(self, data: str):
        """Write input to terminal"""
        import os
        if self.master_fd:
            try:
                os.write(self.master_fd, data.encode('utf-8'))
            except:
                pass

    async def change_window_size(self, rows: int, cols: int):
        """Resize terminal window"""
        import struct
        import fcntl
        import termios

        self.rows = rows
        self.cols = cols

        if self.slave_fd:
            try:
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.slave_fd, termios.TIOCSWINSZ, winsize)
            except:
                pass

    async def get_buffer(self):
        """Get current buffer content"""
        return ''.join(self.buffer)

    async def send_current_buffer(self):
        """Send current buffer to frontend"""
        buffer_content = ''.join(self.buffer)
        await decky.emit(f"terminal_output#{self.id}", buffer_content)

    def subscribe(self):
        """Subscribe to terminal output"""
        self.is_subscribed = True

    def unsubscribe(self):
        """Unsubscribe from terminal output"""
        self.is_subscribed = False

    def close(self):
        """Close terminal"""
        if self.process:
            try:
                self.process.kill()
            except:
                pass
        if hasattr(self, 'master_fd') and self.master_fd:
            try:
                import os
                os.close(self.master_fd)
            except:
                pass
        if hasattr(self, 'slave_fd') and self.slave_fd:
            try:
                import os
                os.close(self.slave_fd)
            except:
                pass

    def serialize(self) -> dict:
        """Serialize terminal state"""
        return {
            "id": self.id,
            "pid": self.process.pid if self.process else None,
            "is_started": self.process is not None,
            "is_completed": self.process and self.process.returncode is not None,
        }


class Plugin:
    ROMS_URL = "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20Advance/"
    terminals = {}

    async def _main(self):
        # Clear log file on startup
        with open(LOG_FILE, 'w') as f:
            f.write("=== ROM Downloader Plugin Loaded ===\n")
        log("Plugin loaded")

    async def _unload(self):
        decky.logger.info("ROM Downloader plugin unloaded")
        # Clean up all terminals
        for terminal_id, terminal in list(self.terminals.items()):
            terminal.close()

    async def _uninstall(self):
        decky.logger.info("ROM Downloader plugin uninstalled")

    # ============= ROM Downloader Methods =============
    async def get_rom_list(self):
        """Fetch and parse ROM listing from Myrient"""
        try:
            decky.logger.info(f"Fetching ROM list from {self.ROMS_URL}")
            response = requests.get(self.ROMS_URL, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            roms = []

            # Find table with ROM files
            table = soup.find('table', id='list')
            if table:
                tbody = table.find('tbody')
                if tbody:
                    for row in tbody.find_all('tr'):
                        cols = row.find_all('td')
                        if len(cols) >= 2:
                            name_link = cols[0].find('a')
                            if name_link:
                                href = name_link.get('href', '')
                                # Skip parent directory links
                                if href.endswith('/') or href in ['../', './']:
                                    continue

                                # Only include .zip files
                                if not href.endswith('.zip'):
                                    continue

                                # Get display name
                                name = name_link.get('title', '') or name_link.text.strip()

                                # Construct full URL
                                if href.startswith('http'):
                                    full_url = href
                                else:
                                    base_url = self.ROMS_URL.rstrip('/')
                                    full_url = f"{base_url}/{href.lstrip('/')}"

                                size = cols[1].text.strip() if len(cols) > 1 else "Unknown"

                                roms.append({
                                    "name": name,
                                    "url": full_url,
                                    "size": size
                                })

            decky.logger.info(f"Found {len(roms)} ROMs")
            return {
                "success": True,
                "roms": roms
            }

        except Exception as e:
            decky.logger.error(f"Error fetching ROM list: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ============= Terminal Methods =============
    async def create_terminal(self, terminal_id: str = None):
        """Create a new terminal"""
        log(f"create_terminal called with id={terminal_id}")

        if terminal_id is None:
            import time
            terminal_id = f'term-{int(time.time())}'

        log(f"create_terminal: Using id={terminal_id}")

        if terminal_id in self.terminals:
            log(f"create_terminal: Terminal {terminal_id} already exists")
            return True

        try:
            log(f"create_terminal: Creating SimpleTerminal")
            terminal = SimpleTerminal(terminal_id)
            log(f"create_terminal: Starting terminal")
            await terminal.start()
            self.terminals[terminal_id] = terminal
            log(f"create_terminal: Terminal created successfully")
            return True
        except Exception as e:
            log(f"create_terminal: ERROR: {e}")
            import traceback
            log(f"create_terminal: TRACEBACK: {traceback.format_exc()}")
            return False

    async def get_terminals(self):
        """Get list of all terminals"""
        log(f"get_terminals: Returning {len(self.terminals)} terminals")
        result = []
        for terminal_id, terminal in self.terminals.items():
            data = terminal.serialize()
            result.append(data)
        return result

    async def get_terminal(self, terminal_id: str):
        """Get a specific terminal"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            log(f"get_terminal: Found {terminal_id}")
            return terminal.serialize()
        log(f"get_terminal: Not found {terminal_id}")
        return None

    async def remove_terminal(self, terminal_id: str):
        """Remove a terminal"""
        log(f"remove_terminal: {terminal_id}")
        if terminal_id in self.terminals:
            self.terminals[terminal_id].close()
            del self.terminals[terminal_id]
            log(f"remove_terminal: Removed {terminal_id}")
            return True
        log(f"remove_terminal: Not found {terminal_id}")
        return False

    async def send_terminal_input(self, terminal_id: str, data: str):
        """Send input to terminal"""
        log(f"send_terminal_input: {terminal_id} data={repr(data)}")
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.write(data)
            log(f"send_terminal_input: Written")
        else:
            log(f"send_terminal_input: Terminal not found")

    async def send_terminal_buffer(self, terminal_id: str):
        """Send current buffer to frontend"""
        log(f"send_terminal_buffer: {terminal_id}")
        terminal = self.terminals.get(terminal_id)
        if terminal:
            await terminal.send_current_buffer()
            log(f"send_terminal_buffer: Sent")
        else:
            log(f"send_terminal_buffer: Terminal not found")

    async def subscribe_terminal(self, terminal_id: str):
        """Subscribe to terminal output"""
        log(f"subscribe_terminal: {terminal_id}")
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.subscribe()
            log(f"subscribe_terminal: Subscribed")
        else:
            log(f"subscribe_terminal: Terminal not found")

    async def unsubscribe_terminal(self, terminal_id: str):
        """Unsubscribe from terminal output"""
        log(f"unsubscribe_terminal: {terminal_id}")
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.unsubscribe()
            log(f"unsubscribe_terminal: Unsubscribed")
        else:
            log(f"unsubscribe_terminal: Terminal not found")

    async def change_terminal_window_size(self, terminal_id: str, rows: int, cols: int):
        """Change terminal window size"""
        log(f"change_terminal_window_size: {terminal_id} {rows}x{cols}")
        terminal = self.terminals.get(terminal_id)
        if terminal:
            await terminal.change_window_size(rows, cols)
            log(f"change_terminal_window_size: Changed")
        else:
            log(f"change_terminal_window_size: Terminal not found")

    async def set_terminal_title(self, terminal_id: str, title: str):
        """Set terminal title"""
        log(f"set_terminal_title: {terminal_id} {title}")
        # SimpleTerminal doesn't support title tracking yet
        pass

    async def get_log(self) -> str:
        """Get the log file contents"""
        try:
            with open(LOG_FILE, 'r') as f:
                return f.read()
        except FileNotFoundError:
            return "Log file not found"
