$("#Search").on("click", function () {
    $("#SearchBar").addClass("open")
    $("#ExitOfSearch").addClass("open")
})

$("#ExitOfSearch").on('click', function () {
    $(this).removeClass("open")
    $("#SearchBar").removeClass("open")
})