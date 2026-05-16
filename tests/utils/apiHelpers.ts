import { Page, APIRequestContext } from '@playwright/test';

export interface ScanResponse {
  transaction_id: string;
  snapshot_version: number;
  status: string;
  summary: {
    risk_score: number;
    risk_label: string;
    total_packages: number;
    direct_dependencies: number;
    transitive_dependencies: number;
    vulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    secure_package_count: number;
    vulnerable_package_count: number;
    priority_fix_count: number;
  };
  grouped_packages: any[];
  vulnerabilities: any[];
  graph: any;
  dependency_tree: any;
  scan_timestamp: number;
}

export const MOCK_DEPENDENCIES = {
  npm: `{
  "dependencies": {
    "express": "4.17.1",
    "lodash": "4.17.4",
    "axios": "0.21.1"
  }
}`,
  python: `requests==2.25.1
flask==1.1.2
jinja2==2.11.3`,
  maven: `<dependencies>
  <dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-core</artifactId>
    <version>5.3.8</version>
  </dependency>
</dependencies>`,
};

export async function performScan(
  page: Page,
  code: string,
  ecosystem: string = 'npm'
): Promise<string> {
  await page.goto('/scan');
  
  // Select ecosystem
  await page.click(`button:has-text("${ecosystem === 'npm' ? 'npm' : ecosystem}")`);
  
  // Paste code
  await page.fill('textarea', code);
  
  // Click scan button
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  
  // Wait for scan to complete (loading overlay on /scan, then navigates to /results)
  await page.waitForURL('/results', { timeout: 120000 });
  
  // Get transaction_id from URL state
  const transactionId = await page.evaluate(() => {
    const state = (window as any).history.state;
    return state?.result?.transaction_id;
  });
  
  return transactionId;
}

export async function getTransactionIdFromPage(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const state = (window as any).history.state;
    return state?.result?.transaction_id;
  });
}

export async function getSnapshotFromPage(page: Page): Promise<ScanResponse> {
  return await page.evaluate(() => {
    const state = (window as any).history.state;
    return state?.result;
  });
}

export async function waitForScanCompletion(page: Page): Promise<void> {
  await page.waitForURL('/results', { timeout: 120000 });
  await page.waitForSelector('text=Vulnerabilities', { timeout: 10000 });
}
