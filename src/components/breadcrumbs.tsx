import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on auth pages
  if (['/login', '/signup', '/404'].includes(location.pathname)) {
    return null;
  }

  // Build breadcrumb items
  const breadcrumbs: { label: string; path: string }[] = [
    { label: 'Home', path: '/dashboard' }
  ];

  // Handle different route patterns
  if (pathSegments.length >= 2) {
    const username = pathSegments[0];
    const collectionName = decodeURIComponent(pathSegments[1]);
    
    // Add username > collection
    breadcrumbs.push({
      label: username,
      path: `/${username}`
    });
    
    breadcrumbs.push({
      label: collectionName,
      path: `/${username}/${encodeURIComponent(collectionName)}`
    });

    // Check for item routes
    if (pathSegments.length >= 4 && pathSegments[2] === 'items') {
      const itemId = pathSegments[3];
      
      if (pathSegments[4] === 'edit') {
        breadcrumbs.push({
          label: 'Edit Item',
          path: `/${username}/${encodeURIComponent(collectionName)}/items/${itemId}/edit`
        });
      } else {
        breadcrumbs.push({
          label: 'View Item',
          path: `/${username}/${encodeURIComponent(collectionName)}/items/${itemId}`
        });
      }
    }
    // Check for edit collection
    else if (pathSegments[2] === 'edit') {
      breadcrumbs.push({
        label: 'Edit Collection',
        path: `/${username}/${encodeURIComponent(collectionName)}/edit`
      });
    }
    else if (pathSegments[2] === 'stats') {
      breadcrumbs.push({
        label: 'Statistics',
        path: `/${username}/${encodeURIComponent(collectionName)}/edit`
      });
    }
    else if (pathSegments[2] === 'wishlist') {
      breadcrumbs.push({
        label: 'Wishlist',
        path: `/${username}/${encodeURIComponent(collectionName)}/wishlist`
      });
    }
    // Check for add item
    else if (pathSegments[2] === 'add-item') {
      breadcrumbs.push({
        label: 'Add Item',
        path: `/${username}/${encodeURIComponent(collectionName)}/add-item`
      });
    }
  }
  // Handle /collections/new
  else if (pathSegments[0] === 'collections' && pathSegments[1] === 'new') {
    breadcrumbs.push({
      label: 'New Collection',
      path: '/collections/new'
    });
  }
  // Handle /profile
  else if (pathSegments[0] === 'profile') {
    breadcrumbs.push({
      label: 'Profile',
      path: '/profile'
    });
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
          
          {index === 0 ? (
            <Link 
              to={crumb.path} 
              className="flex items-center hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
            </Link>
          ) : index === breadcrumbs.length - 1 ? (
            // Last item - not a link
            <span className="text-foreground font-medium">
              {crumb.label}
            </span>
          ) : (
            // Middle items - links
            <Link 
              to={crumb.path}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}