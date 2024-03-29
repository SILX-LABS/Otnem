self.addEventListener('push', function(event) {
  var myNotif = event.data.json()
    var options = {
      body: myNotif.disc || "Discription",
      icon: myNotif.image || 'images/example.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      },
      actions: [
        {action: myNotif.link || 'https://www.google.com', title: 'Open',
          icon: 'images/checkmark.png'},
        {action: 'close', title: 'Close',
          icon: 'images/xmark.png'},
      ]
    }
    event.waitUntil(
      self.registration.showNotification(myNotif.title || "Something happened",options)
    )
  })