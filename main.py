import decky
import requests
from bs4 import BeautifulSoup
import os
import asyncio

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

    async def start(self):
        """Start the terminal process"""
        import pty
        import struct
        import fcntl
        import termios

        # Open PTY
        self.master_fd, self.slave_fd = pty.openpty()

        # Set terminal size
        winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
        fcntl.ioctl(self.slave_fd, termios.TIOCSWINSZ, winsize)

        # Start shell process
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

        # Start reading output
        asyncio.create_task(self._read_output_loop())

    async def _read_output_loop(self):
        """Read output from PTY and broadcast to subscribers"""
        import os
        while self.process and self.process.returncode is None:
            try:
                data = await asyncio.to_thread(os.read, self.master_fd, 4096)
                if data:
                    output = data.decode('utf-8', errors='ignore')
                    self.buffer.append(output)
                    if self.is_subscribed:
                        await decky.emit(f"terminal_output#{self.id}", output)
            except:
                break
            await asyncio.sleep(0.01)

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
        decky.logger.info("ROM Downloader plugin loaded")

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
        if terminal_id is None:
            import time
            terminal_id = f'term-{int(time.time())}'

        if terminal_id in self.terminals:
            return True

        try:
            terminal = SimpleTerminal(terminal_id)
            await terminal.start()
            self.terminals[terminal_id] = terminal
            decky.logger.info(f"Created terminal: {terminal_id}")
            return True
        except Exception as e:
            decky.logger.error(f"Error creating terminal: {e}")
            import traceback
            decky.logger.error(traceback.format_exc())
            return False

    async def get_terminals(self):
        """Get list of all terminals"""
        result = []
        for terminal_id, terminal in self.terminals.items():
            data = terminal.serialize()
            result.append(data)
        return result

    async def get_terminal(self, terminal_id: str):
        """Get a specific terminal"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            return terminal.serialize()
        return None

    async def remove_terminal(self, terminal_id: str):
        """Remove a terminal"""
        if terminal_id in self.terminals:
            self.terminals[terminal_id].close()
            del self.terminals[terminal_id]
            return True
        return False

    async def send_terminal_input(self, terminal_id: str, data: str):
        """Send input to terminal"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.write(data)

    async def send_terminal_buffer(self, terminal_id: str):
        """Send current buffer to frontend"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            await terminal.send_current_buffer()

    async def subscribe_terminal(self, terminal_id: str):
        """Subscribe to terminal output"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.subscribe()

    async def unsubscribe_terminal(self, terminal_id: str):
        """Unsubscribe from terminal output"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.unsubscribe()

    async def change_terminal_window_size(self, terminal_id: str, rows: int, cols: int):
        """Change terminal window size"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            await terminal.change_window_size(rows, cols)

    async def set_terminal_title(self, terminal_id: str, title: str):
        """Set terminal title"""
        # SimpleTerminal doesn't support title tracking yet
        pass
