/** Default rate per job type, in GBP. Editable per invoice line before the invoice is issued. */
export const DEFAULT_RATES: Record<string, number> = {
  check_in: 125,
  check_out: 100,
  mid_term: 100,
};

/** Printed under PAYMENT INFO. Override any line with the matching environment variable. */
export function paymentInfo(): string[] {
  const env = process.env;
  return [
    env.INVOICE_BANK_NAME ?? "Natwest Bank",
    `Account Name: ${env.INVOICE_ACCOUNT_NAME ?? "Patrik Zsoldos"}`,
    `Account No.: ${env.INVOICE_ACCOUNT_NUMBER ?? "60670053"}`,
    `Sort Code: ${env.INVOICE_SORT_CODE ?? "60-02-09"}`,
  ];
}
