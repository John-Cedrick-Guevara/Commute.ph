/**
 * Sample fare matrix based on LTFRB reference rates.
 * ⚠ These are demo values for prototype purposes only.
 * Always confirm actual fares with the driver/operator.
 */
export const FARE_MATRIX = {
  Jeepney: {
    baseFare: 14.00,
    baseKm: 4,
    extraPerKm: 1.80,
    label: 'Traditional Jeepney',
  },
  'Beep Jeep': {
    baseFare: 14.00,
    baseKm: 4,
    extraPerKm: 2.20,
    label: 'Modern E-Jeep (Beep Jeep)',
  },
}

/**
 * Discount rates per passenger type.
 * Students, Senior Citizens, and PWDs get 20% off under RA 9994 / RA 10754.
 */
export const DISCOUNT_RATES = {
  Regular:        0.00,
  Student:        0.20,
  'Senior Citizen': 0.20,
  PWD:            0.20,
}
