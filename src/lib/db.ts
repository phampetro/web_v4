import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'Ve$Mau@Trai!Tim',
  server: '118.69.76.220',
  port: 2403,
  database: 'DMS_Report',
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
