import { parseIndianDate } from './src/utils/dateUtils';

const testDates = [
    "05/03/2026",
    "05-03-2026",
    "2026-03-05",
    "12/12/2025",
    "bad date"
];

let allPassed = true;

for (const raw of testDates) {
    const parsed = parseIndianDate(raw);
    console.log(`Input: "${raw}" -> Parsed: "${parsed}"`);
    if (parsed) {
        const dateObj = new Date(parsed);
        console.log(`  => Year: ${dateObj.getFullYear()}, Month: ${dateObj.getMonth() + 1}, Date: ${dateObj.getDate()}`);
        // Check if month is 3 for the first three tests
        if (["05/03/2026", "05-03-2026", "2026-03-05"].includes(raw)) {
            if (dateObj.getMonth() + 1 !== 3) {
                console.error(`  [!] FAIL: Expected month 3, got ${dateObj.getMonth() + 1}`);
                allPassed = false;
            }
        }
    } else {
        if (raw !== "bad date") {
            console.error(`  [!] FAIL: Expected non-null for "${raw}"`);
            allPassed = false;
        }
    }
}

if (allPassed) {
    console.log("✅ All tests passed!");
} else {
    console.error("❌ Some tests failed.");
    process.exit(1);
}
