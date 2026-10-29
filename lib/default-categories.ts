import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'

export const defaultCategories = [
  { name: 'Salário', type: 'income', color: 'green', icon: 'work' },
  { name: 'Renda extra', type: 'income', color: 'green', icon: 'wallet' },
  { name: 'Alimentação', type: 'expense', color: 'orange', icon: 'food' },
  { name: 'Moradia', type: 'expense', color: 'blue', icon: 'home' },
  { name: 'Transporte', type: 'expense', color: 'blue', icon: 'transport' },
  { name: 'Saúde', type: 'expense', color: 'red', icon: 'health' },
  { name: 'Educação', type: 'expense', color: 'purple', icon: 'education' },
  { name: 'Lazer', type: 'expense', color: 'purple', icon: 'leisure' },
  { name: 'Compras', type: 'expense', color: 'orange', icon: 'shopping' },
  { name: 'Presentes', type: 'expense', color: 'pink', icon: 'gift' },
  { name: 'Cuidados pessoais', type: 'expense', color: 'pink', icon: 'barber' },
  { name: 'Cartão de crédito', type: 'expense', color: 'red', icon: 'bill' },
]

export async function createDefaultCategories(userId: string) {
  await db.insert(categories).values(defaultCategories.map(item => ({ ...item, userId }))).onConflictDoNothing()
}
