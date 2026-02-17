import argon2 from 'argon2'

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await argon2.verify(hash, password)
}
