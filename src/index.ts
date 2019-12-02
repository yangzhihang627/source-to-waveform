let input: HTMLElement | null = document.getElementById('source')
input && input.addEventListener('change', function(ev: Event): void {
    let files = ev.target && (<HTMLInputElement>ev.target).files, file
    if(files && files.length > 0) {
        file = files[0]
        console.log(file)
    }
}, false)