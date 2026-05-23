import { useState, useEffect } from 'react';

export function usePermissions() {
  const [permissions, setPermissions] = useState<{
    canEdit: boolean;
    canDelete: boolean;
    isLoaded: boolean;
  }>({
    canEdit: true,
    canDelete: true,
    isLoaded: false
  });

  useEffect(() => {
    const mainUserStr = localStorage.getItem('currentUser');
    const lpoUserStr = localStorage.getItem('app_lpos_user');
    
    // Admin Sabry always has full access
    const checkIsAdmin = (name: string) => name?.toLowerCase() === 'med sabry';

    if (mainUserStr) {
      const mainUser = JSON.parse(mainUserStr);
      if (checkIsAdmin(mainUser.name)) {
        setPermissions({ canEdit: true, canDelete: true, isLoaded: true });
        return;
      }

      try {
        const perms = JSON.parse(mainUser.role || '{}');
        const dbActions = perms['database-actions'] || [];
        
        // delete action implies edit, edit implies view
        const canDelete = dbActions.includes('delete');
        const canEdit = canDelete || dbActions.includes('edit');
        
        setPermissions({
          canEdit,
          canDelete,
          isLoaded: true
        });
      } catch (e) {
        setPermissions({ canEdit: true, canDelete: true, isLoaded: true });
      }
    } else if (lpoUserStr) {
      const lpoUser = JSON.parse(lpoUserStr);
      if (checkIsAdmin(lpoUser.NAME) || lpoUser.ROLE === 'admin') {
        setPermissions({ canEdit: true, canDelete: true, isLoaded: true });
      } else {
        // Legacy/Standalone behavior: all users have full access unless specified
        setPermissions({ canEdit: true, canDelete: true, isLoaded: true });
      }
    } else {
      setPermissions({ canEdit: false, canDelete: false, isLoaded: true });
    }
  }, []);

  return permissions;
}
