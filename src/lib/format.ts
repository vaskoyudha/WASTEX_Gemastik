const idNumber = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/** Format integer rupiah with id-ID grouping and manual `Rp ` prefix. */
export function formatRupiah(amount: number): string {
  return `Rp ${idNumber.format(amount)}`;
}

