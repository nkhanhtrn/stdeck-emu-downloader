import decky

class Plugin:
    async def _main(self):
        decky.logger.info("ROM Downloader plugin loaded")

    async def _unload(self):
        decky.logger.info("ROM Downloader plugin unloaded")

    async def _uninstall(self):
        decky.logger.info("ROM Downloader plugin uninstalled")
