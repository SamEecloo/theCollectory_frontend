export const setTagFilter = (
  collectionName: string,
  userName: string,
  fieldId: string,
  tag: string,
  isPublicView: boolean,
  navigate: (path: string) => void
) => {
  console.log("inside filterUtils - setTagFilter")
  // Create fresh filters with only this tag
  const updatedFilters = {
    search: '',
    values: {
      [fieldId]: [tag]
    },
    isExpanded: true
  };

  // Save to sessionStorage
  if(isPublicView){
    const storageKey = `filters_public-${collectionName}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedFilters));
    navigate(`/${userName}/${collectionName}`);
  } else {
    const storageKey = `filters_${collectionName}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedFilters));
    navigate(`/collections/${collectionName}`);
  }  
};