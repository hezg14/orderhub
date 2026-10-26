import { Router } from 'express';
import { auditRouter } from './audit';
import { authRouter } from './auth';
import { customersRouter } from './customers';
import { dashboardRouter } from './dashboard';
import { ordersRouter } from './orders';
import { productsRouter } from './products';
import { reportsRouter } from './reports';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/users', usersRouter);
