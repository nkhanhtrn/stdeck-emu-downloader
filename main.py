import decky
import requests
from bs4 import BeautifulSoup
import os
import pty
import select
import subprocess
import threading
import time
from typing import Dict, Optional

class SimpleTerminal:
    def __init__(self, terminal_id: str, shell: str = None):
        self.id = terminal_id
        self.pid = None
        self.fd = None
        self.subscribers = []
        self.buffer = []
        self.lock = threading.Lock()
        self.title = None
        self.is_running = False

        # Determine shell to use
        if shell is None:
            shell = os.environ.get('SHELL', '/bin/bash')

        # Spawn PTY
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            # Child process - spawn shell
            os.execvp(shell, [shell])
        else:
            # Parent process
            self.is_running = True
            # Start output thread
            self.output_thread = threading.Thread(target=self._read_output, daemon=True)
            self.output_thread.start()

    def _read_output(self):
        """Read output from PTY and send to subscribers"""
        while self.is_running:
            try:
                # Check if there's data to read
                r, _, _ = select.select([self.fd], [], [], 0.1)
                if r:
                    try:
                        data = os.read(self.fd, 4096)
                        if data:
                            output = data.decode('utf-8', errors='ignore')
                            self.buffer.append(output)
                            # Notify subscribers
                            for callback in self.subscribers:
                                try:
                                    decky.emit_to_client(callback, output)
                                except:
                                    pass
                    except OSError:
                        break
            except:
                break

    def write(self, data: str):
        """Write input to terminal"""
        if self.is_running and self.fd is not None:
            try:
                os.write(self.fd, data.encode('utf-8'))
            except:
                pass

    def get_buffer(self) -> str:
        """Get current buffer content"""
        with self.lock:
            return ''.join(self.buffer)

    def subscribe(self, callback):
        """Subscribe to terminal output"""
        if callback not in self.subscribers:
            self.subscribers.append(callback)

    def unsubscribe(self, callback):
        """Unsubscribe from terminal output"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)

    def resize(self, rows: int, cols: int):
        """Resize terminal window"""
        if self.is_running and self.fd is not None:
            try:
                import fcntl
                import struct
                import termios
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            except:
                pass

    def close(self):
        """Close terminal"""
        self.is_running = False
        if self.fd is not None:
            try:
                os.close(self.fd)
            except:
                pass
        if self.pid is not None:
            try:
                os.kill(self.pid, 9)
            except:
                pass

    def serialize(self) -> dict:
        """Serialize terminal state"""
        return {
            "id": self.id,
            "pid": self.pid,
            "is_started": True,
            "is_completed": not self.is_running,
            "title": self.title
        }


class Plugin:
    ROMS_URL = "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20Advance/"
    terminals: Dict[str, SimpleTerminal] = {}

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
    async def create_terminal(self, terminal_id: str = None) -> bool:
        """Create a new terminal"""
        if terminal_id is None:
            terminal_id = f'term-{int(time.time())}'

        if terminal_id in self.terminals:
            return True

        try:
            terminal = SimpleTerminal(terminal_id)
            self.terminals[terminal_id] = terminal
            decky.logger.info(f"Created terminal: {terminal_id}")
            return True
        except Exception as e:
            decky.logger.error(f"Error creating terminal: {e}")
            return False

    async def get_terminals(self) -> list:
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

    async def remove_terminal(self, terminal_id: str) -> bool:
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
            buffer_content = terminal.get_buffer()
            # Send buffer via event
            decky.emit_to_client(f'terminal_output#{terminal_id}', buffer_content)

    async def subscribe_terminal(self, terminal_id: str):
        """Subscribe to terminal output"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.subscribe(f'terminal_output#{terminal_id}')

    async def unsubscribe_terminal(self, terminal_id: str):
        """Unsubscribe from terminal output"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.unsubscribe(f'terminal_output#{terminal_id}')

    async def change_terminal_window_size(self, terminal_id: str, rows: int, cols: int):
        """Change terminal window size"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.resize(rows, cols)

    async def set_terminal_title(self, terminal_id: str, title: str):
        """Set terminal title"""
        terminal = self.terminals.get(terminal_id)
        if terminal:
            terminal.title = title
