
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const width = 1920;
const height = 1080;
const fps = 30;
const duration = 5;
const totalFrames = fps * duration;

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const framesDir = path.join(projectDir, "frames");

await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({
  headless: true
});

const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1
});

await page.goto(
  `file://${path.join(projectDir, "index.html")}`
);

for (let i = 0; i < totalFrames; i++) {
  await page.evaluate((seconds) => {
    window.setFrame(seconds);
  }, i / fps);

  await page.screenshot({
    path: path.join(
      framesDir,
      `frame-${String(i).padStart(5, "0")}.png`
    )
  });
}

await browser.close();

execFileSync("ffmpeg", [
  "-y",
  "-framerate", String(fps),
  "-i", path.join(framesDir, "frame-%05d.png"),
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  path.join(projectDir, "motion-studio-demo.mp4")
], {
  stdio: "inherit"
});

console.log("BERHASIL: motion-studio-demo.mp4");
