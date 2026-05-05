import sql from 'mssql';

const config = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || '',
  options: {
    encrypt: false, // Nếu dùng Azure thì true
    trustServerCertificate: true,
  },
};

let pool: import('mssql').ConnectionPool | null = null;

export async function connectToDB() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export default sql;
