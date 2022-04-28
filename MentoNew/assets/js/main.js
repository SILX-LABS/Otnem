$("#Search").on("click", function () {
    $("#SearchBar").addClass("open")
    $("#ExitOfSearch").addClass("open")
})

$("#ExitOfSearch").on('click', function () {
    $(this).removeClass("open")
    $("#SearchBar").removeClass("open")
})

  
    $ = function(id) {
  return document.getElementById(id);
}

var show = function(id) {
  $(id).style.display ='block';
}
var hide = function(id) {
  $(id).style.display ='none';
}
