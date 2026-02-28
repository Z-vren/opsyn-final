import { t } from 'i18next';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEmbedding } from '@/components/embed-provider';
import { buttonVariants } from '@/components/ui/button';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar-shadcn';
import { ProjectSwitcher } from '@/features/projects/components/project-switcher';
import { flagsHooks } from '@/hooks/flags-hooks';
import { cn, determineDefaultRoute } from '@/lib/utils';
import { ApEdition, ApFlagId } from '@activepieces/shared';

import { OpSynLogoIcon } from '@/components/ui/opsyn-logo';

export const AppSidebarHeader = () => {
  const { embedState } = useEmbedding();
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const branding = flagsHooks.useWebsiteBranding();
  const showSwitcher =
    edition !== ApEdition.COMMUNITY && !embedState.isEmbedded;
  const defaultRoute = determineDefaultRoute();

  return (
    <SidebarHeader>
      <SidebarMenu>
        {showSwitcher ? (
          <SidebarMenuItem className="flex items-center justify-center gap-1">
            <Link
              to="/"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
              title={t('Home')}
            >
              <Home className="h-4 w-4" />
            </Link>
            <Link
              to={defaultRoute}
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
            >
              <OpSynLogoIcon className="h-5 w-5" aria-label={t('Dashboard')} />
            </Link>
            <ProjectSwitcher />
          </SidebarMenuItem>
        ) : (
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'ghost' }))}
          >
            <div className="flex items-center justify-center w-40">
              <OpSynLogoIcon className="h-6 w-6 mr-2" />
              <span className="font-semibold tracking-tight">OpSyn</span>
            </div>
          </Link>
        )}
      </SidebarMenu>
    </SidebarHeader>
  );
};
