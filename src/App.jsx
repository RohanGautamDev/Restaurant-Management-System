import React from 'react';
import RestaurantRegistration from './pages/RestaurantRegistration';

function App() {
  return (
    <div className="app-root">
      <RestaurantRegistration
        onRegisterSuccess={(data) => {
          console.log('Registration completed successfully:', data);
        }}
      />
    </div>
  );
}

export default App;
