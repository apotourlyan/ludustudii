// Renders JUnit XML reports as Markdown for a CI job summary, one section
// per suite: passed, failed, skipped and time, and the failed tests by name.
// `make ci-test-summary` runs it; Node runs it by stripping its types, so it
// may use only syntax that strips.
//
// Usage: node junit-summary.ts <title>=<report.xml>...
// A report that doesn't exist (its suite didn't run) is skipped. A report
// that can't be read gets a section that says so, and the script exits with
// 1 after writing the others.

import { existsSync, readFileSync } from "node:fs";

import { DOMParser, type Element } from "@xmldom/xmldom";

// Failed tests listed per suite; a summary is limited to 1 MiB.
const MAX_FAILED_LISTED = 50;

interface Result {
  passed: number;
  failed: number;
  skipped: number;
  seconds: number;
  failedNames: string[];
}

function main(args: string[]): void {
  const sections: string[] = [];
  for (const arg of args) {
    const separator = arg.indexOf("=");
    if (separator <= 0) {
      throw new Error(`junit-summary: want <title>=<report.xml>, got '${arg}'`);
    }
    const title = arg.slice(0, separator);
    const path = arg.slice(separator + 1);
    if (!existsSync(path)) {
      continue;
    }
    try {
      sections.push(render(title, read(path)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sections.push(`### ⚠️ ${escape(title)}\n\nThe report couldn't be read: ${escape(message)}\n`);
      process.exitCode = 1;
    }
  }
  process.stdout.write(
    sections.length > 0 ? sections.join("\n") : "No test reports were written.\n",
  );
}

// The counts come from the test cases, since the tools fill in the totals'
// attributes differently. A test case with a failure or an error failed.
function read(path: string): Result {
  // The parser's first error or fatal error. The parser stops at a fatal
  // error and wraps anything onError throws, so it's thrown afterwards.
  let parseError: string | undefined;
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") {
        parseError ??= message;
      }
    },
  });
  let document;
  try {
    document = parser.parseFromString(readFileSync(path, "utf8"), "text/xml");
  } catch (error) {
    parseError ??= error instanceof Error ? error.message : String(error);
  }
  if (parseError !== undefined || !document) {
    throw new Error(`${path}: ${parseError ?? "not XML"}`);
  }
  const root = document.documentElement;
  if (!root || (root.tagName !== "testsuites" && root.tagName !== "testsuite")) {
    throw new Error(`${path}: not a JUnit report`);
  }

  const result: Result = { passed: 0, failed: 0, skipped: 0, seconds: 0, failedNames: [] };
  for (const testCase of Array.from(root.getElementsByTagName("testcase"))) {
    if (hasChild(testCase, "failure") || hasChild(testCase, "error")) {
      result.failed++;
      result.failedNames.push(testName(testCase));
    } else if (hasChild(testCase, "skipped")) {
      result.skipped++;
    } else {
      result.passed++;
    }
  }
  // The run's time if the report has one, otherwise its suites' times.
  result.seconds = root.hasAttribute("time")
    ? timeOf(root)
    : Array.from(root.getElementsByTagName("testsuite")).reduce(
        (sum, suite) => sum + timeOf(suite),
        0,
      );
  return result;
}

function hasChild(element: Element, tagName: string): boolean {
  return Array.from(element.getElementsByTagName(tagName)).some(
    (child) => child.parentNode === element,
  );
}

function testName(testCase: Element): string {
  const className = testCase.getAttribute("classname") ?? "";
  const name = testCase.getAttribute("name") ?? "";
  return className && className !== name ? `${className} › ${name}` : name;
}

function timeOf(element: Element): number {
  const value = Number.parseFloat(element.getAttribute("time") ?? "");
  return Number.isFinite(value) ? value : 0;
}

function render(title: string, result: Result): string {
  const lines = [
    `### ${result.failed > 0 ? "❌" : "✅"} ${escape(title)}`,
    "",
    "| Passed | Failed | Skipped | Time |",
    "| ---: | ---: | ---: | ---: |",
    `| ${result.passed} | ${result.failed} | ${result.skipped} | ${duration(result.seconds)} |`,
    "",
  ];
  if (result.failed > 0) {
    lines.push("Failed:", "");
    for (const name of result.failedNames.slice(0, MAX_FAILED_LISTED)) {
      lines.push(`- ${escape(name)}`);
    }
    if (result.failedNames.length > MAX_FAILED_LISTED) {
      lines.push(`- and ${result.failedNames.length - MAX_FAILED_LISTED} more`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function duration(seconds: number): string {
  if (seconds < 59.95) {
    return `${seconds.toFixed(1)} s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${whole % 60} s`;
}

// Test names are text: HTML's special characters become entities and
// Markdown's are escaped, so a name renders as written.
function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(/[\\`*_{}[\]()#+\-.!|~]/g, "\\$&")
    .replaceAll(/\s+/g, " ");
}

main(process.argv.slice(2));
