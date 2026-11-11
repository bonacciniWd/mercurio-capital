export const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function isValidCpf(raw: string): boolean {
  const value = onlyDigits(raw)
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index)
    return ((sum * 10) % 11) % 10
  }
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}

export function isValidCnpj(raw: string): boolean {
  const value = onlyDigits(raw)
  if (value.length !== 14 || /^(\d)\1{13}$/.test(value)) return false
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13])
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export const isValidPhone = (value: string) => onlyDigits(value).length >= 10 && onlyDigits(value).length <= 13
