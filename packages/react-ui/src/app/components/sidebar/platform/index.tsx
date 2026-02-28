import { t } from 'i18next';
import {
  ArrowLeft,
  LayoutGrid,
  LineChart,
  Server,
  Shield,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarHeader,
  SidebarGroup,
  SidebarMenuButton,
} from '@/components/ui/sidebar-shadcn';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { flagsHooks } from '@/hooks/flags-hooks';
import { platformHooks } from '@/hooks/platform-hooks';
import { projectApi } from '@/lib/project-api';
import { cn, determineDefaultRoute } from '@/lib/utils';
import { ApEdition, ApFlagId } from '@activepieces/shared';

import { OpSynLogoIcon } from '@/components/ui/opsyn-logo';

import { ApSidebareGroup, SidebarGeneralItemType } from '../ap-sidebar-group';
import { ApSidebarItem } from '../ap-sidebar-item';
import { SidebarUser } from '../sidebar-user';

export function PlatformSidebar() {
  const [setupOpen, setSetupOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [infrastructureOpen, setInfrastructureOpen] = useState(false);
  const navigate = useNavigate();
  const { platform } = platformHooks.useCurrentPlatform();
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const defaultRoute = determineDefaultRoute();
  const branding = flagsHooks.useWebsiteBranding();

  const handleExitPlatformAdmin = async () => {
    // Check if user has any projects
    try {
      const projectsList = await projectApi.list({ limit: 1 });
      if (projectsList.data && projectsList.data.length > 0) {
        // User has projects, navigate to default route (which will use a project)
        navigate(defaultRoute);
      } else {
        // User has no projects, go to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      // If we can't fetch projects, go to dashboard as fallback
      navigate('/dashboard');
    }
  };

  const items: SidebarGeneralItemType[] = [
    {
      type: 'link',
      to: '/platform/analytics',
      label: t('Overview'),
      icon: LineChart,
      locked: !platform.plan.analyticsEnabled,
      isSubItem: false,
      show: Boolean(edition && [ApEdition.CLOUD, ApEdition.ENTERPRISE].includes(edition)),
    },
    {
      type: 'link',
      to: '/platform/projects',
      label: t('Projects'),
      icon: LayoutGrid,
      isSubItem: false,
      show: true,
    },
    {
      type: 'link',
      to: '/platform/users',
      label: t('Users'),
      icon: Users,
      isSubItem: false,
      show: true,
    },
    {
      type: 'group',
      label: t('Setup'),
      icon: Wrench,
      open: setupOpen,
      setOpen: setSetupOpen,
      isActive: (pathname: string) => pathname.includes('/setup'),
      items: [
        {
          type: 'link',
          to: '/platform/setup/branding',
          label: t('Branding'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/setup/connections',
          label: t('Global Connections'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/setup/pieces',
          label: t('Pieces'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/setup/templates',
          label: t('Templates'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/setup/billing',
          label: t('Billing'),
          isSubItem: true,
          show: edition !== ApEdition.COMMUNITY,
        },
      ],
    },
    {
      type: 'group',
      label: t('Security'),
      open: securityOpen,
      setOpen: setSecurityOpen,
      isActive: (pathname: string) => pathname.includes('/security'),
      icon: Shield,
      items: [
        {
          type: 'link',
          to: '/platform/security/audit-logs',
          label: t('Audit Logs'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/security/sso',
          label: t('Single Sign On'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/security/signing-keys',
          label: t('Signing Keys'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/security/project-roles',
          label: t('Project Roles'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/security/api-keys',
          label: t('API Keys'),
          isSubItem: true,
          show: true,
        },
      ],
    },
    {
      type: 'group',
      label: t('Infrastructure'),
      icon: Server,
      open: infrastructureOpen,
      setOpen: setInfrastructureOpen,
      isActive: (pathname: string) => pathname.includes('/infrastructure'),
      items: [
        {
          type: 'link',
          to: '/platform/infrastructure/workers',
          label: t('Workers'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/infrastructure/health',
          label: t('Health'),
          isSubItem: true,
          show: true,
        },
        {
          type: 'link',
          to: '/platform/infrastructure/triggers',
          label: t('Triggers'),
          isSubItem: true,
          show: true,
        },
      ],
    },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="w-full py-2 flex items-center gap-2">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
          >
            <OpSynLogoIcon className="h-5 w-5" aria-label={t('Home')} />
          </Link>
          <h1 className="truncate font-semibold">OpSyn</h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items
              .filter((item) => item.type === 'group' || item.show !== false)
              .map((item) =>
                item.type === 'group' ? (
                  <ApSidebareGroup key={item.label} {...item} />
                ) : (
                  <ApSidebarItem key={item.label} {...item} />
                ),
              )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuButton
            onClick={handleExitPlatformAdmin}
            className="py-5 px-2"
          >
            <ArrowLeft />
            {t('Exit platform admin')}
          </SidebarMenuButton>
        </SidebarMenu>
        <SidebarUser />
      </SidebarFooter>
    </Sidebar>
  );
}
