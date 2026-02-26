import decky
import requests
from bs4 import BeautifulSoup
import os

class Plugin:
    ROMS_URL = "https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Game%20Boy%20Advance/"

    async def _main(self):
        decky.logger.info("ROM Downloader plugin loaded")

    async def _unload(self):
        decky.logger.info("ROM Downloader plugin unloaded")

    async def _uninstall(self):
        decky.logger.info("ROM Downloader plugin uninstalled")

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
