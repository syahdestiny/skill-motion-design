
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { once } from "node:events";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const OUTPUT = "day-one-arabic-self-assessment.mp4";

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1
  });

  const htmlPath = pathToFileURL(resolve("index.html")).href;

  await page.goto(htmlPath, { waitUntil: "load" });

  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
  });

  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });

  const duration = await page.evaluate(() => window.getDuration());
  const totalFrames = Math.ceil(duration * FPS);

  console.log(`Video duration: ${duration} seconds`);
  console.log(`Resolution: ${WIDTH}x${HEIGHT}`);
  console.log(`Frames: ${totalFrames}`);

  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-f", "image2pipe",
    "-vcodec", "png",
    "-framerate", String(FPS),
    "-i", "pipe:0",
    "-an",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    OUTPUT
  ], { stdio: ["pipe", "ignore", "pipe"] });

  let ffmpegError = "";

  ffmpeg.stderr.on("data", chunk => {
    ffmpegError += chunk.toString();
  });

  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg gagal (${code}): ${ffmpegError}`));
    });
  });

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      const seconds = frame / FPS;

      await page.evaluate(t => window.setFrame(t), seconds);

      const image = await page.screenshot({
        type: "png",
        animations: "disabled"
      });

      if (!ffmpeg.stdin.write(image)) {
        await once(ffmpeg.stdin, "drain");
      }

      if (frame % 150 === 0) {
        console.log(
          `Rendering: ${frame}/${totalFrames} frames`
        );
      }
    }

    ffmpeg.stdin.end();
    await ffmpegDone;

    console.log(`Selesai: ${OUTPUT}`);
  } catch (error) {
    ffmpeg.stdin.destroy();
    ffmpeg.kill();
    throw error;
  }
} finally {
  await browser.close();
}
