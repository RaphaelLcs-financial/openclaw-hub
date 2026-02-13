/**
 * Prisma Client Singleton
 * 用于数据库操作的统一入口
 */

const { PrismaClient } = require('@prisma/client');

// 防止在开发环境创建多个实例
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
