import 'server-only';
import type { PanelMe } from '@ashian/shared';
import { accountGet, type AccountResult } from './account-api';

export const getPanelMe = (): Promise<AccountResult<PanelMe>> => accountGet<PanelMe>('/v1/agent/me');