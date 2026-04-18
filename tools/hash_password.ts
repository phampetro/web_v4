import bcrypt from 'bcryptjs';

async function hashPassword(plainPassword: string) {
  const saltRounds = 12; // Độ mạnh của salt, nên >= 10
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  return hash;
}

// Ví dụ sử dụng:
(async () => {
  const plainPassword = '123456a@A';
  const hash = await hashPassword(plainPassword);
  console.log('Mã băm:', hash);
})();
